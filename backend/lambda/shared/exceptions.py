"""Custom exception types for WIAL Lambda functions."""


class WialBaseError(Exception):
    """Base exception for all WIAL platform errors."""

    def __init__(self, code: str, message: str, status_code: int) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.status_code = status_code

    def to_dict(self) -> dict:
        return {
            "error": {
                "code": self.code,
                "message": self.message,
            }
        }


class ValidationError(WialBaseError):
    """Raised when input validation fails."""

    def __init__(self, message: str) -> None:
        super().__init__(
            code="VALIDATION_ERROR",
            message=message,
            status_code=400,
        )


class ProvisioningError(WialBaseError):
    """Raised when chapter provisioning fails."""

    def __init__(self, message: str) -> None:
        super().__init__(
            code="PROVISIONING_FAILED",
            message=message,
            status_code=500,
        )


class PaymentError(WialBaseError):
    """Raised when payment processing fails."""

    def __init__(self, message: str) -> None:
        super().__init__(
            code="PAYMENT_FAILED",
            message=message,
            status_code=502,
        )


class AuthorizationError(WialBaseError):
    """Raised when a user lacks required permissions."""

    def __init__(self, message: str = "Insufficient permissions") -> None:
        super().__init__(
            code="AUTHORIZATION_ERROR",
            message=message,
            status_code=403,
        )


class SearchUnavailableError(WialBaseError):
    """Raised when the AI search pipeline is unavailable."""

    def __init__(self, message: str = "AI search is temporarily unavailable") -> None:
        super().__init__(
            code="SEARCH_UNAVAILABLE",
            message=message,
            status_code=503,
        )
