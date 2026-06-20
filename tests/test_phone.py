import pytest
from app.utils.phone import safe_normalize_phone

def test_safe_normalize_phone_valid():
    assert safe_normalize_phone("0712345678") == "254712345678"
    assert safe_normalize_phone("0112345678") == "254112345678"
    assert safe_normalize_phone("+254712345678") == "254712345678"
    assert safe_normalize_phone("+254112345678") == "254112345678"
    assert safe_normalize_phone("254712345678") == "254712345678"
    assert safe_normalize_phone("254112345678") == "254112345678"
    assert safe_normalize_phone("712345678") == "254712345678"
    assert safe_normalize_phone("112345678") == "254112345678"

def test_safe_normalize_phone_integers_and_floats():
    assert safe_normalize_phone(712345678) == "254712345678"
    assert safe_normalize_phone(254712345678) == "254712345678"
    assert safe_normalize_phone(254712345678.0) == "254712345678"

def test_safe_normalize_phone_formatting():
    # Includes spaces and hyphens
    assert safe_normalize_phone(" +254 712-345-678 ") == "254712345678"

def test_safe_normalize_phone_invalid():
    # Should fallback cleanly without crashing
    assert safe_normalize_phone("000000") == "254700000000"
    assert safe_normalize_phone("invalid") == "254700000000"
    assert safe_normalize_phone(None) == "254700000000"
    assert safe_normalize_phone(object()) == "254700000000"

def test_safe_normalize_phone_custom_fallback():
    assert safe_normalize_phone("invalid", fallback="254799999999") == "254799999999"
