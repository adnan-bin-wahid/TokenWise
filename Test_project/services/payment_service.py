import uuid
import time
from models.payment import PaymentTransaction, PaymentStatus
from config.settings import config
from utils.logger import log_info, log_error, log_audit

class PaymentProcessingError(Exception):
    """Raised when payment processing encounters a fatal or connection error."""
    pass

class PaymentService:
    """Handles payment transactions and gateway retries."""
    
    def __init__(self):
        self._transactions: dict[str, PaymentTransaction] = {}

    def process_payment(self, user_id: str, amount_cents: int, card_number: str) -> PaymentTransaction:
        """Processes a payment with retry mechanisms and error handling."""
        tx_id = f"tx_{uuid.uuid4().hex[:8]}"
        transaction = PaymentTransaction(
            transaction_id=tx_id,
            user_id=user_id,
            amount_cents=amount_cents
        )
        self._transactions[tx_id] = transaction

        for attempt in range(1, config.MAX_PAYMENT_RETRIES + 1):
            transaction.retry_count = attempt
            try:
                log_info(f"Attempting payment {tx_id} (Attempt {attempt}/{config.MAX_PAYMENT_RETRIES})...")
                ref = self._call_payment_gateway_api(card_number, amount_cents)
                
                transaction.status = PaymentStatus.SUCCESS
                transaction.gateway_reference = ref
                log_audit(user_id, "payment_charge", f"SUCCESS_{amount_cents}_CENTS")
                return transaction

            except TimeoutError as te:
                log_error(f"Gateway timeout on payment {tx_id}: {te}")
                transaction.error_message = f"Timeout error on attempt {attempt}: {te}"
                if attempt == config.MAX_PAYMENT_RETRIES:
                    transaction.status = PaymentStatus.FAILED
                    log_audit(user_id, "payment_charge", "FAILED_TIMEOUT")
                    raise PaymentProcessingError(f"Payment failed after {config.MAX_PAYMENT_RETRIES} attempts due to gateway timeout.")
                time.sleep(0.5)

            except ValueError as ve:
                log_error(f"Validation failure for payment {tx_id}: {ve}")
                transaction.status = PaymentStatus.FAILED
                transaction.error_message = str(ve)
                log_audit(user_id, "payment_charge", "FAILED_INVALID_INPUT")
                return transaction

        return transaction(filtered 13 lines)
    def __init__(self):
        self._transactions: dict[str, PaymentTransaction] = {}

    def process_payment(self, user_id: str, amount_cents: int, card_number: str) -> PaymentTransaction:
        """Processes a payment with retry mechanisms and error handling."""
        tx_id = f"tx_{uuid.uuid4().hex[:8]}"
        transaction = PaymentTransaction(
            transaction_id=tx_id,
            user_id=user_id,
            amount_cents=amount_cents
        )
        self._transactions[tx_id] = transaction

        for attempt in range(1, config.MAX_PAYMENT_RETRIES + 1):
            transaction.retry_count = attempt
            try:
                log_info(f"Attempting payment {tx_id} (Attempt {attempt}/{config.MAX_PAYMENT_RETRIES})...")
                ref = self._call_payment_gateway_api(card_number, amount_cents)
                
                transaction.status = PaymentStatus.SUCCESS
                transaction.gateway_reference = ref
                log_audit(user_id, "payment_charge", f"SUCCESS_{amount_cents}_CENTS")
                return transaction

            except TimeoutError as te:
                log_error(f"Gateway timeout on payment {tx_id}: {te}")
                transaction.error_message = f"Timeout error on attempt {attempt}: {te}"
                if attempt == config.MAX_PAYMENT_RETRIES:
                    transaction.status = PaymentStatus.FAILED
                    log_audit(user_id, "payment_charge", "FAILED_TIMEOUT")
                    raise PaymentProcessingError(f"Payment failed after {config.MAX_PAYMENT_RETRIES} attempts due to gateway timeout.")
                time.sleep(0.5)

            except ValueError as ve:
                log_error(f"Validation failure for payment {tx_id}: {ve}")
                transaction.status = PaymentStatus.FAILED
                transaction.error_message = str(ve)
                log_audit(user_id, "payment_charge", "FAILED_INVALID_INPUT")
                return transaction

        return transaction

    def _call_payment_gateway_api(self, card_number: str, amount_cents: int) -> str:
        """Simulates external payment gateway API call with timeout checks."""
        if not card_number or len(card_number) < 13:
            raise ValueError("Invalid card number format")
            
        if card_number.endswith("0000"):
            # Simulate gateway connection timeout
            raise TimeoutError("Connection timed out reaching payment gateway endpoint")
            
        return f"gw_ref_{uuid.uuid4().hex[:12]}"

    def _call_payment_gateway_api(self, card_number: str, amount_cents: int) -> str:
        """Simulates external payment gateway API call with timeout checks."""
        if not card_number or len(card_number) < 13:
            raise ValueError("Invalid card number format")
            
        if card_number.endswith("0000"):
            # Simulate gateway connection timeout
            raise TimeoutError("Connection timed out reaching payment gateway endpoint")
            
        return f"gw_ref_{uuid.uuid4().hex[:12]}"
