import math
from typing import List, Dict, Union


def compute_shannon_entropy(addresses: List[str], normalize: bool = False) -> float:
    """
    Compute Shannon entropy (in bits) of an address sequence.

    Args:
        addresses: list of string identifiers (e.g. wallet addresses)
        normalize: if True, return entropy normalized to [0,1]

    Returns:
        Shannon entropy value (rounded to 4 decimals), optionally normalized
    """
    if not addresses:
        return 0.0

    freq: Dict[str, int] = {}
    for a in addresses:
        freq[a] = freq.get(a, 0) + 1

    total = len(addresses)
    entropy = 0.0
    for count in freq.values():
        p = count / total
        entropy -= p * math.log2(p)

    if normalize and total > 1:
        max_entropy = math.log2(total)
        if max_entropy > 0:
            entropy /= max_entropy

    return round(entropy, 4)


def entropy_distribution(addresses: List[str]) -> Dict[str, Union[int, float]]:
    """
    Compute distribution details for entropy analysis.

    Returns dict with frequencies, probabilities, and entropy.
    """
    if not addresses:
        return {"total": 0, "unique": 0, "entropy": 0.0, "probs": {}}

    freq: Dict[str, int] = {}
    for a in addresses:
        freq[a] = freq.get(a, 0) + 1

    total = len(addresses)
    probs: Dict[str, float] = {k: v / total for k, v in freq.items()}
    entropy = compute_shannon_entropy(addresses)

    return {
        "total": total,
        "unique": len(freq),
        "entropy": entropy,
        "probs": {k: round(p, 4) for k, p in probs.items()},
    }
