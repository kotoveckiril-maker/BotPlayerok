import queries from "./queries.json";

const BASE_URL = "https://playerok.com";
const GRAPHQL_URL = `${BASE_URL}/graphql`;

// Persisted queries (sha256), используются веб-клиентом Playerok.
const PQ = {
  deals: "591b0e6d036c2120c8f95b97dbfdf5635df3747cd901f4895e009935229417ef",
  deal: "d0421fb8dea49652876d69b1a14ce2c715ea9c7127c48c85a78e06de31a845ae",
  userChats: "c1ddbcd7c8b87160ac25e0734f9dc32fc945287b056f4b14abf1473bfb1ad11a",
  chatMessages:
    "9b4e264ff1b20e0fd3929afe023dee8f50affc02b85f80cb4b3dc1516ecfbaa0",
  items: "3f20c731f8f769a094ee3fa32e09f8e12250357e9a4f0ebb4e6988e7a0bb9260",
  itemPriorityStatuses:
    "b922220c6f979537e1b99de6af8f5c13727daeff66727f679f07f986ce1c025a",
} as const;

const Q = queries as Record<string, string>;

export class PlayerokError extends Error {
  constructor(
    message: string,
    public kind: "auth" | "botcheck" | "http" | "graphql" | "network",
  ) {
    super(message);
  }
}

export type DealStatus =
  | "PAID"
  | "PENDING"
  | "SENT"
  | "CONFIRMED"
  | "CONFIRMED_AUTOMATICALLY"
  | "ROLLED_BACK";

export type ItemStatus =
  | "PENDING_APPROVAL"
  | "PENDING_MODERATION"
  | "APPROVED"
  | "DECLINED"
  | "BLOCKED"
  | "EXPIRED"
  | "SOLD"
  | "DRAFT";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Json = any;

export interface Deal {
  id: string;
  status: DealStatus;
  direction?: string;
  createdAt?: string;
  user?: { id: string; username: string } | null;
  chat?: { id: string } | null;
  item?: { id: string; name: string; price?: number } | null;
}

export interface ChatMessage {
  id: string;
  text: string | null;
  createdAt: string;
  user?: { id: string; username?: string; role?: string } | null;
  deal?: { id: string } | null;
  event?: string | null;
  isAutoResponse?: boolean | null;
}

export interface Chat {
  id: string;
  type?: string;
  unreadMessagesCounter?: number;
  lastMessage?: ChatMessage | null;
  participants?: { id: string; username: string }[];
}

export interface MyItem {
  id: string;
  name: string;
  status: ItemStatus;
  price: number;
  priority?: string;
  priorityPosition?: number;
  viewsCounter?: number;
  slug?: string;
  statusExpirationDate?: string | null;
}

export interface PriorityStatus {
  id: string;
  price: number;
  name: string;
  type: string;
}

export interface PlayerokCredentials {
  token: string;
  cookies?: string;
  userAgent?: string;
}

export class PlayerokClient {
  private cookie: string;
  private ua: string;
  userId = "";
  username = "";

  constructor(creds: PlayerokCredentials) {
    const extra = (creds.cookies ?? "").trim();
    if (extra) {
      // Полный Cookie-заголовок из браузера (токен + __ddg* и т.д.)
      this.cookie = /(^|;\s*)token=/.test(extra)
        ? extra
        : `token=${creds.token}; ${extra}`;
    } else {
      this.cookie = `token=${creds.token}`;
    }
    this.ua =
      creds.userAgent?.trim() ||
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36";
  }

  private headers(op: string): Record<string, string> {
    return {
      accept: "*/*",
      "accept-language": "ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7",
      "apollo-require-preflight": "true",
      "apollographql-client-name": "web",
      "content-type": "application/json",
      cookie: this.cookie,
      origin: BASE_URL,
      referer: `${BASE_URL}/`,
      "user-agent": this.ua,
      "x-gql-op": op,
      "x-gql-path": "/",
      "x-timezone-offset": "-180",
      "x-apollo-operation-name": op,
    };
  }

  private async send(
    method: "GET" | "POST",
    op: string,
    body: Record<string, unknown>,
  ): Promise<Json> {
    let url = GRAPHQL_URL;
    let init: RequestInit;
    if (method === "GET") {
      const params = new URLSearchParams();
      for (const [k, v] of Object.entries(body)) {
        params.set(k, typeof v === "string" ? v : JSON.stringify(v));
      }
      url += `?${params.toString()}`;
      init = { method, headers: this.headers(op) };
    } else {
      init = {
        method,
        headers: this.headers(op),
        body: JSON.stringify(body),
      };
    }

    let res: Response;
    try {
      res = await fetch(url, {
        ...init,
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      });
    } catch (e) {
      throw new PlayerokError(
        `Сетевая ошибка: ${e instanceof Error ? e.message : String(e)}`,
        "network",
      );
    }

    const text = await res.text();
    const botSigs = [
      "Just a moment",
      "_cf_chl_opt",
      "Enable JavaScript and cookies to continue",
      "Checking your browser",
      "cf-browser-verification",
      "Cloudflare Ray ID",
      "DDoS-Guard",
    ];
    if (botSigs.some((s) => text.includes(s))) {
      throw new PlayerokError(
        "Playerok отклонил запрос антибот-защитой. Вставьте полный Cookie из браузера (включая __ddg*) в настройках и запускайте бота с того же IP.",
        "botcheck",
      );
    }

    let json: Json = null;
    try {
      json = JSON.parse(text);
    } catch {
      /* not json */
    }

    if (json?.errors?.length) {
      const msg = json.errors
        .map((e: Json) => e?.message)
        .filter(Boolean)
        .join("; ");
      const unauth = json.errors.some(
        (e: Json) =>
          e?.extensions?.code === "UNAUTHENTICATED" ||
          /unauth|авториз/i.test(e?.message ?? ""),
      );
      throw new PlayerokError(
        `GraphQL (${op}): ${msg || "ошибка"}`,
        unauth ? "auth" : "graphql",
      );
    }
    if (!res.ok && res.status !== 304) {
      throw new PlayerokError(
        `HTTP ${res.status} при запросе ${op}`,
        res.status === 401 || res.status === 403 ? "auth" : "http",
      );
    }
    if (!json) {
      throw new PlayerokError(`Пустой/некорректный ответ на ${op}`, "http");
    }
    return json.data;
  }

  private persisted(op: keyof typeof PQ, variables: Record<string, unknown>) {
    return this.send("GET", op, {
      operationName: op,
      variables: JSON.stringify(variables),
      extensions: JSON.stringify({
        persistedQuery: { version: 1, sha256Hash: PQ[op] },
      }),
    });
  }

  private mutate(op: string, variables: Record<string, unknown>) {
    const query = Q[op];
    if (!query) throw new Error(`Нет запроса ${op}`);
    return this.send("POST", op, { operationName: op, query, variables });
  }

  /** Авторизация / данные аккаунта. */
  async init() {
    const data = await this.send("POST", "viewer", {
      operationName: "viewer",
      query: Q.viewer,
      variables: {},
    });
    const v = data?.viewer;
    if (!v) throw new PlayerokError("Токен недействителен (viewer = null)", "auth");
    this.userId = v.id;
    this.username = v.username;
    return {
      id: v.id as string,
      username: v.username as string,
      balance: (v.balance?.value ?? 0) as number,
      isBlocked: !!v.isBlocked,
      canPublishItems: !!v.canPublishItems,
      unreadChats: (v.unreadChatsCounter ?? 0) as number,
    };
  }

  /* ------------------------------ Сделки ------------------------------ */

  async getDeals(
    statuses: DealStatus[],
    direction: "IN" | "OUT" = "OUT",
    count = 24,
  ): Promise<Deal[]> {
    const data = await this.persisted("deals", {
      pagination: { first: count, after: null },
      filter: { userId: this.userId, direction, status: statuses },
      showForbiddenImage: true,
    });
    return (data?.deals?.edges ?? []).map((e: Json) => e.node as Deal);
  }

  async getDeal(id: string): Promise<Deal> {
    const data = await this.persisted("deal", {
      id,
      hasSupportAccess: false,
      showForbiddenImage: true,
    });
    return data?.deal as Deal;
  }

  async updateDeal(id: string, status: DealStatus) {
    await this.mutate("updateDeal", { input: { id, status } });
  }

  /* ------------------------------ Чаты ------------------------------ */

  async getChats(count = 24): Promise<Chat[]> {
    const data = await this.persisted("userChats", {
      pagination: { first: count, after: null },
      filter: { userId: this.userId },
      hasSupportAccess: false,
    });
    return (data?.chats?.edges ?? []).map((e: Json) => e.node as Chat);
  }

  async getChatMessages(chatId: string, count = 20): Promise<ChatMessage[]> {
    const data = await this.persisted("chatMessages", {
      pagination: { first: count, after: null },
      filter: { chatId },
      hasSupportAccess: false,
      showForbiddenImage: true,
    });
    const list: ChatMessage[] = (data?.chatMessages?.edges ?? []).map(
      (e: Json) => e.node as ChatMessage,
    );
    return list.sort(
      (a, b) => +new Date(a.createdAt) - +new Date(b.createdAt),
    );
  }

  async sendMessage(chatId: string, text: string) {
    await this.mutate("createChatMessage", {
      input: { chatId, imagesIds: [], text },
      showForbiddenImage: true,
    });
  }

  async markChatAsRead(chatId: string) {
    await this.mutate("markChatAsRead", { input: { chatId } });
  }

  /* ------------------------------ Товары ------------------------------ */

  async getMyItems(
    statuses: ItemStatus[],
    maxPages = 3,
  ): Promise<MyItem[]> {
    const out: MyItem[] = [];
    let after: string | null = null;
    for (let i = 0; i < maxPages; i++) {
      const data: Json = await this.persisted("items", {
        pagination: { first: 24, after },
        filter: { userId: this.userId, status: statuses },
        showForbiddenImage: true,
      });
      const conn = data?.items;
      for (const e of conn?.edges ?? []) out.push(e.node as MyItem);
      if (!conn?.pageInfo?.hasNextPage) break;
      after = conn.pageInfo.endCursor;
    }
    return out;
  }

  async getPriorityStatuses(
    itemId: string,
    price: number,
  ): Promise<PriorityStatus[]> {
    const data = await this.persisted("itemPriorityStatuses", {
      itemId,
      price: Math.round(price),
    });
    return (data?.itemPriorityStatuses ?? []) as PriorityStatus[];
  }

  async publishItem(itemId: string, priorityStatusId: string) {
    await this.mutate("publishItem", {
      input: {
        transactionProviderId: "LOCAL",
        priorityStatuses: [priorityStatusId],
        itemId,
      },
      showForbiddenImage: true,
    });
  }

  async increasePriority(itemId: string, priorityStatusId: string) {
    await this.mutate("increaseItemPriorityStatus", {
      input: {
        itemId,
        priorityStatuses: [priorityStatusId],
        transactionProviderData: { paymentMethodId: null },
        transactionProviderId: "LOCAL",
      },
    });
  }
}
