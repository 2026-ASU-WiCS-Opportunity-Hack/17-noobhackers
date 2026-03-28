/**
 * API client utility for all backend endpoints.
 *
 * Attaches Cognito JWT token to protected requests, handles errors
 * (401 → redirect to login, 403 → permissions message), and provides
 * typed methods for each resource.
 *
 * Requirements: all API integration
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "/api";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ApiError {
  code: string;
  message: string;
}

export interface ApiResponse<T> {
  data?: T;
  error?: ApiError;
  status: number;
}

// ---------------------------------------------------------------------------
// Core fetch wrapper
// ---------------------------------------------------------------------------

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = localStorage.getItem("wial_auth_user");
    if (!stored) return null;
    return JSON.parse(stored).idToken ?? null;
  } catch {
    return null;
  }
}

async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<ApiResponse<T>> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  try {
    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers,
    });

    const body = await res.json().catch(() => ({}));

    if (res.status === 401 && typeof window !== "undefined") {
      localStorage.removeItem("wial_auth_user");
      window.location.href = "/login";
      return { status: 401, error: { code: "UNAUTHORIZED", message: "Session expired" } };
    }

    if (res.status === 403) {
      return {
        status: 403,
        error: body.error ?? { code: "FORBIDDEN", message: "Insufficient permissions" },
      };
    }

    if (!res.ok) {
      return {
        status: res.status,
        error: body.error ?? { code: "API_ERROR", message: "Request failed" },
      };
    }

    return { status: res.status, data: body as T };
  } catch (err) {
    return {
      status: 0,
      error: { code: "NETWORK_ERROR", message: "Unable to reach the server" },
    };
  }
}

// ---------------------------------------------------------------------------
// Chapters
// ---------------------------------------------------------------------------

export interface Chapter {
  chapterId: string;
  chapterName: string;
  slug: string;
  region: string;
  status: string;
  externalLink?: string;
}

export const chapters = {
  list: () => apiFetch<{ chapters: Chapter[] }>("/chapters"),
  get: (id: string) => apiFetch<Chapter>(`/chapters/${id}`),
  create: (body: Partial<Chapter>) =>
    apiFetch<{ chapterId: string; url: string; status: string }>("/chapters", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  update: (id: string, body: Partial<Chapter>) =>
    apiFetch<Chapter>(`/chapters/${id}`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  delete: (id: string) =>
    apiFetch<Chapter>(`/chapters/${id}`, { method: "DELETE" }),
};

// ---------------------------------------------------------------------------
// Coaches
// ---------------------------------------------------------------------------

export interface Coach {
  coachId: string;
  name: string;
  photoUrl?: string;
  certificationLevel: string;
  location: string;
  contactInfo: string;
  bio: string;
  chapterId: string;
  status: string;
}

export interface SearchResult {
  results: Coach[];
  fallback: boolean;
}

export const coaches = {
  list: (params?: { chapterId?: string; certificationLevel?: string }) => {
    const qs = new URLSearchParams();
    if (params?.chapterId) qs.set("chapterId", params.chapterId);
    if (params?.certificationLevel) qs.set("certificationLevel", params.certificationLevel);
    const query = qs.toString() ? `?${qs}` : "";
    return apiFetch<{ coaches: Coach[] }>(`/coaches${query}`);
  },
  get: (id: string) => apiFetch<Coach>(`/coaches/${id}`),
  create: (body: Partial<Coach>) =>
    apiFetch<Coach>("/coaches", { method: "POST", body: JSON.stringify(body) }),
  update: (id: string, body: Partial<Coach>) =>
    apiFetch<{ coachId: string; status: string }>(`/coaches/${id}`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  approve: (id: string) =>
    apiFetch<{ coachId: string; status: string }>(`/coaches/${id}/approve`, {
      method: "POST",
    }),
  search: (q: string, chapter?: string, limit = 20) => {
    const qs = new URLSearchParams({ q, limit: String(limit) });
    if (chapter) qs.set("chapter", chapter);
    return apiFetch<SearchResult>(`/coaches/search?${qs}`);
  },
};

// ---------------------------------------------------------------------------
// Payments
// ---------------------------------------------------------------------------

export interface Payment {
  paymentId: string;
  chapterId: string;
  paymentMethod: string;
  dueType: string;
  quantity: number;
  totalAmount: number;
  status: string;
  createdAt: string;
}

export interface CreatePaymentBody {
  chapterId: string;
  paymentMethod: "stripe" | "paypal";
  dueType: "student_enrollment" | "coach_certification";
  quantity: number;
  payerEmail: string;
}

export const payments = {
  list: (chapterId?: string) => {
    const qs = chapterId ? `?chapterId=${chapterId}` : "";
    return apiFetch<{ payments: Payment[] }>(`/payments${qs}`);
  },
  get: (id: string) => apiFetch<Payment>(`/payments/${id}`),
  create: (body: CreatePaymentBody) =>
    apiFetch<{ paymentId: string; amount: number; status: string }>("/payments", {
      method: "POST",
      body: JSON.stringify(body),
    }),
};

// ---------------------------------------------------------------------------
// Metrics
// ---------------------------------------------------------------------------

export interface GlobalMetrics {
  activeChapters: number;
  totalCoaches: number;
  totalRevenue: number;
  paymentConversionRate: number;
  duesCollectionStatus: Record<string, number>;
}

export interface ChapterMetrics {
  chapterId: string;
  revenue: number;
  coachCount: number;
  membershipGrowthRate: number;
  paymentConversionRate: number;
  duesCollectionStatus: Record<string, number>;
}

export const metrics = {
  global: () => apiFetch<GlobalMetrics>("/metrics/global"),
  chapter: (id: string) => apiFetch<ChapterMetrics>(`/metrics/chapters/${id}`),
};

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

export const templates = {
  get: () => apiFetch<{ template: Record<string, unknown> }>("/templates"),
  update: (body: Record<string, unknown>) =>
    apiFetch<{ version: number; syncStatus: string }>("/templates", {
      method: "PUT",
      body: JSON.stringify(body),
    }),
};

// ---------------------------------------------------------------------------
// Pages (chapter content)
// ---------------------------------------------------------------------------

export interface PageContent {
  pageSlug: string;
  title: string;
  content: string;
}

export const pages = {
  list: (chapterId: string) =>
    apiFetch<{ pages: PageContent[] }>(`/chapters/${chapterId}/pages`),
  get: (chapterId: string, slug: string) =>
    apiFetch<PageContent>(`/chapters/${chapterId}/pages/${slug}`),
  update: (chapterId: string, slug: string, body: { title: string; content: string }) =>
    apiFetch<PageContent>(`/chapters/${chapterId}/pages/${slug}`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),
};

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

export interface User {
  cognitoUserId: string;
  email: string;
  role: string;
  assignedChapters: string[];
}

export const users = {
  list: () => apiFetch<{ users: User[] }>("/users"),
  create: (body: { email: string; role: string; assignedChapters?: string[] }) =>
    apiFetch<User>("/users", { method: "POST", body: JSON.stringify(body) }),
  changeRole: (id: string, role: string) =>
    apiFetch<User>(`/users/${id}/role`, {
      method: "PUT",
      body: JSON.stringify({ role }),
    }),
  deactivate: (id: string) =>
    apiFetch<User>(`/users/${id}`, { method: "DELETE" }),
};
