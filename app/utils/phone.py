import logging
import re
from typing import Any

logger = logging.getLogger(__name__)

# Pre-compiled regular expression for maximum performance in async loops
# Matches:
# - Optional starting '+'
# - Optional '254' or '0' prefix
# - Followed by exactly 9 digits starting with '1' or '7'
PHONE_REGEX = re.compile(r"^(?:(?:\+?254)|0)?([17]\d{8})$")

def safe_normalize_phone(raw_phone: Any, fallback: str = "254700000000") -> str:
    """
    Ultra-fast phone number standardizer for Kenyan mobile formats.
    Expects formats like '0712345678', '+254712345678', '254112345678', '712345678'.
    """
    if raw_phone is None:
        logger.warning(f"Phone normalization failed: Input is None. Falling back to {fallback}")
        return fallback

    try:
        # Coerce to string cleanly, stripping spaces, and handle scientific notation if cast from float
        val_str = str(raw_phone).strip()

        # In case a float like 254712345678.0 is passed
        if val_str.endswith(".0"):
            val_str = val_str[:-2]

        # Strip all whitespace or hyphens
        val_str = val_str.replace(" ", "").replace("-", "")

        match = PHONE_REGEX.match(val_str)
        if match:
            # Group 1 contains the 9 digits starting with 1 or 7
            return "254" + match.group(1)

        logger.warning(f"Phone normalization failed: Unrecognized pattern '{val_str}'. Falling back to {fallback}")
        return fallback

    except Exception as e:
        logger.warning(f"Phone normalization failed: Unhandled exception ({e}) processing {raw_phone}. Falling back to {fallback}")
        return fallback
