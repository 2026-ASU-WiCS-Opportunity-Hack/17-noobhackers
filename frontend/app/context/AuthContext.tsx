"use client";

/**
 * Cognito Auth Context — real authentication against AWS Cognito.
 *
 * Calls Cognito InitiateAuth API directly (no SDK needed).
 * Extracts role from JWT cognito:groups claim.
 * Stores session in localStorage, validates on mount.
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
  signIn: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  hasRole: (role: UserRole) => boolean;
  hasChapterAccess: (chapterId: string) => boolean;
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const COGNITO_REGION = process.env.NEXT_PUBLIC_COGNITO_REGION ?? "us-east-2";
const CLIENT_ID = process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID ?? "";
const COGNITO_ENDPOINT = `https://cognito-idp.${COGNITO_REGION}.amazonaws.com`;

const ROLE_HIERARCHY: Record<UserRole, number> = {
  Super_Admin: 4,
  Chapter_Lead: 3,
  Content_Creator: 2,
  Coach: 1,
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// ---------------------------------------------------------------------------
// JWT decode (no library needed — just base64)
// ---------------------------------------------------------------------------

function decodeJwtPayload(token: string): Record<string, unknown> {
  try {
    const payload = token.split(".")[1];
    const decoded = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(decoded);
  } catch {
    return {};
  }
}

function resolveRoleFromGroups(groups: string[]): UserRole {
  const mapping: Record<string, UserRole> = {
    SuperAdmins: "Super_Admin",
    ChapterLeads: "Chapter_Lead",
    ContentCreators: "Content_Creator",
    Coaches: "Coach",
  };
  for (const g of ["SuperAdmins", "ChapterLeads", "ContentCreators", "Coaches"]) {
    if (groups.includes(g)) return mapping[g];
  }
  return "Coach";
}

function buildUserFromToken(idToken: string): AuthUser | null {
  const claims = decodeJwtPayload(idToken);
  if (!claims.sub) return null;

  const groups = (claims["cognito:groups"] as string[]) ?? [];
  const role = resolveRoleFromGroups(groups);

  return {
    cognitoUserId: claims.sub as string,
    email: (claims.email as string) ?? "",
    role,
    assignedChapters: [],
    idToken,
  };
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // On mount: restore session from localStorage
  useEffect(() => {
    const stored = typeof window !== "undefined"
      ? localStorage.getItem("wial_auth_user")
      : null;

    if (stored) {
      try {
        const parsed = JSON.parse(stored) as AuthUser;
        // Check if token is expired
        const claims = decodeJwtPayload(parsed.idToken);
        const exp = (claims.exp as number) ?? 0;
        if (Date.now() / 1000 < exp) {
          setUser(parsed);
        } else {
          localStorage.removeItem("wial_auth_user");
        }
      } catch {
        localStorage.removeItem("wial_auth_user");
      }
    }
    setIsLoading(false);
  }, []);

  const signIn = useCallback(
    async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
      if (!CLIENT_ID) {
        return { success: false, error: "Authentication not configured. Set NEXT_PUBLIC_COGNITO_CLIENT_ID." };
      }

      try {
        const res = await fetch(COGNITO_ENDPOINT, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-amz-json-1.1",
            "X-Amz-Target": "AWSCognitoIdentityProviderService.InitiateAuth",
          },
          body: JSON.stringify({
            AuthFlow: "USER_PASSWORD_AUTH",
            ClientId: CLIENT_ID,
            AuthParameters: {
              USERNAME: email,
              PASSWORD: password,
            },
          }),
        });

        const data = await res.json();

        if (!res.ok) {
          const errType = data.__type ?? "";
          if (errType.includes("NotAuthorizedException")) {
            return { success: false, error: "Incorrect email or password." };
          }
          if (errType.includes("UserNotFoundException")) {
            return { success: false, error: "No account found with this email." };
          }
          if (errType.includes("UserNotConfirmedException")) {
            return { success: false, error: "Account not confirmed. Contact your administrator." };
          }
          return { success: false, error: data.message ?? "Authentication failed." };
        }

        const idToken = data.AuthenticationResult?.IdToken;
        if (!idToken) {
          return { success: false, error: "No token received from authentication service." };
        }

        const authUser = buildUserFromToken(idToken);
        if (!authUser) {
          return { success: false, error: "Failed to parse authentication token." };
        }

        setUser(authUser);
        localStorage.setItem("wial_auth_user", JSON.stringify(authUser));
        return { success: true };

      } catch (err) {
        return { success: false, error: "Unable to reach authentication service. Check your connection." };
      }
    },
    [],
  );

  const logout = useCallback(() => {
    setUser(null);
    localStorage.removeItem("wial_auth_user");
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
      signIn,
      logout,
      hasRole,
      hasChapterAccess,
    }),
    [user, isLoading, signIn, logout, hasRole, hasChapterAccess],
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

export function RouteGuard({ children, requiredRole, chapterId }: RouteGuardProps) {
  const { isLoading, isAuthenticated, hasRole, hasChapterAccess } = useAuth();

  useEffect(() => {
    if (!isLoading && !isAuthenticated && typeof window !== "undefined") {
      window.location.href = "/login";
    }
  }, [isLoading, isAuthenticated]);

  if (isLoading) {
    return <div className="flex min-h-[50vh] items-center justify-center"><p className="text-wial-gray-500">Loading...</p></div>;
  }

  if (!isAuthenticated) {
    return <div className="flex min-h-[50vh] items-center justify-center"><p className="text-wial-gray-500">Redirecting to login...</p></div>;
  }

  if (requiredRole && !hasRole(requiredRole)) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4">
        <h2 className="text-xl font-semibold text-wial-error">Insufficient Permissions</h2>
        <p className="text-wial-gray-600">You do not have the required role to access this page.</p>
      </div>
    );
  }

  if (chapterId && !hasChapterAccess(chapterId)) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4">
        <h2 className="text-xl font-semibold text-wial-error">Insufficient Permissions</h2>
        <p className="text-wial-gray-600">You do not have access to this chapter.</p>
      </div>
    );
  }

  return <>{children}</>;
}
