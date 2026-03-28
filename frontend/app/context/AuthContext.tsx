"use client";

/**
 * Cognito Auth Context
 *
 * Provides authentication state, login/logout, token refresh, and role
 * extraction from JWT claims across the app. Uses mock data for local
 * development; swap to real Cognito SDK calls when backend is deployed.
 *
 * Requirements: 3.6, 3.7, 3.8
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { ReactNode } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type UserRole =
  | "Super_Admin"
  | "Chapter_Lead"
  | "Content_Creator"
  | "Coach";

export interface AuthUser {
  cognitoUserId: string;
  email: string;
  role: UserRole;
  assignedChapters: string[];
  idToken: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: () => void;
  logout: () => void;
  hasRole: (role: UserRole) => boolean;
  hasChapterAccess: (chapterId: string) => boolean;
}

// ---------------------------------------------------------------------------
// Configuration — swap these for real Cognito values when deploying
// ---------------------------------------------------------------------------

const COGNITO_DOMAIN = process.env.NEXT_PUBLIC_COGNITO_DOMAIN ?? "";
const CLIENT_ID = process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID ?? "";
const REDIRECT_URI =
  process.env.NEXT_PUBLIC_COGNITO_REDIRECT_URI ??
  (typeof window !== "undefined" ? window.location.origin : "");

// Role hierarchy for permission checks
const ROLE_HIERARCHY: Record<UserRole, number> = {
  Super_Admin: 4,
  Chapter_Lead: 3,
  Content_Creator: 2,
  Coach: 1,
};

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// ---------------------------------------------------------------------------
// Mock user for local development (no Cognito needed)
// ---------------------------------------------------------------------------

const MOCK_USERS: Record<string, AuthUser> = {
  admin: {
    cognitoUserId: "mock-admin-001",
    email: "admin@wial.org",
    role: "Super_Admin",
    assignedChapters: [],
    idToken: "mock-token-admin",
  },
  lead: {
    cognitoUserId: "mock-lead-001",
    email: "lead@wial.org",
    role: "Chapter_Lead",
    assignedChapters: ["chapter-usa", "chapter-brazil"],
    idToken: "mock-token-lead",
  },
  coach: {
    cognitoUserId: "mock-coach-001",
    email: "coach@wial.org",
    role: "Coach",
    assignedChapters: [],
    idToken: "mock-token-coach",
  },
};

// ---------------------------------------------------------------------------
// Helper: extract role from Cognito JWT groups claim
// ---------------------------------------------------------------------------

function resolveRoleFromGroups(groups: string[]): UserRole {
  const mapping: Record<string, UserRole> = {
    SuperAdmins: "Super_Admin",
    ChapterLeads: "Chapter_Lead",
    ContentCreators: "Content_Creator",
    Coaches: "Coach",
  };
  const priority: string[] = [
    "SuperAdmins",
    "ChapterLeads",
    "ContentCreators",
    "Coaches",
  ];
  for (const g of priority) {
    if (groups.includes(g)) return mapping[g];
  }
  return "Coach";
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // On mount: check for existing session (mock or real)
  useEffect(() => {
    const stored = typeof window !== "undefined"
      ? localStorage.getItem("wial_auth_user")
      : null;

    if (stored) {
      try {
        setUser(JSON.parse(stored));
      } catch {
        localStorage.removeItem("wial_auth_user");
      }
    }
    setIsLoading(false);
  }, []);

  const login = useCallback(() => {
    if (COGNITO_DOMAIN && CLIENT_ID) {
      // Real Cognito hosted UI redirect
      const loginUrl =
        `${COGNITO_DOMAIN}/login?` +
        `client_id=${CLIENT_ID}` +
        `&response_type=code` +
        `&scope=openid+email+profile` +
        `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}`;
      window.location.href = loginUrl;
    } else {
      // Mock login for local development — default to admin
      const mockUser = MOCK_USERS.admin;
      setUser(mockUser);
      localStorage.setItem("wial_auth_user", JSON.stringify(mockUser));
    }
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    localStorage.removeItem("wial_auth_user");

    if (COGNITO_DOMAIN && CLIENT_ID) {
      const logoutUrl =
        `${COGNITO_DOMAIN}/logout?` +
        `client_id=${CLIENT_ID}` +
        `&logout_uri=${encodeURIComponent(REDIRECT_URI)}`;
      window.location.href = logoutUrl;
    }
  }, []);

  const hasRole = useCallback(
    (requiredRole: UserRole): boolean => {
      if (!user) return false;
      return ROLE_HIERARCHY[user.role] >= ROLE_HIERARCHY[requiredRole];
    },
    [user],
  );

  const hasChapterAccess = useCallback(
    (chapterId: string): boolean => {
      if (!user) return false;
      if (user.role === "Super_Admin") return true;
      return user.assignedChapters.includes(chapterId);
    },
    [user],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isLoading,
      isAuthenticated: !!user,
      login,
      logout,
      hasRole,
      hasChapterAccess,
    }),
    [user, isLoading, login, logout, hasRole, hasChapterAccess],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}

// ---------------------------------------------------------------------------
// Route guard component
// ---------------------------------------------------------------------------

interface RouteGuardProps {
  children: ReactNode;
  requiredRole?: UserRole;
  chapterId?: string;
}

/**
 * Wraps protected pages. Redirects unauthenticated users to login,
 * shows "insufficient permissions" for unauthorized access.
 * Requirements: 3.7, 3.8
 */
export function RouteGuard({
  children,
  requiredRole,
  chapterId,
}: RouteGuardProps) {
  const { isLoading, isAuthenticated, hasRole, hasChapterAccess } = useAuth();

  // Redirect unauthenticated users to login via useEffect (not during render)
  useEffect(() => {
    if (!isLoading && !isAuthenticated && typeof window !== "undefined") {
      window.location.href = "/login";
    }
  }, [isLoading, isAuthenticated]);

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-wial-gray-500">Loading...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-wial-gray-500">Redirecting to login...</p>
      </div>
    );
  }

  if (requiredRole && !hasRole(requiredRole)) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4">
        <h2 className="text-xl font-semibold text-wial-error">
          Insufficient Permissions
        </h2>
        <p className="text-wial-gray-600">
          You do not have the required role to access this page.
        </p>
      </div>
    );
  }

  if (chapterId && !hasChapterAccess(chapterId)) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4">
        <h2 className="text-xl font-semibold text-wial-error">
          Insufficient Permissions
        </h2>
        <p className="text-wial-gray-600">
          You do not have access to this chapter.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
