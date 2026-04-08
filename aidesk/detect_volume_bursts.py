from typing import List, Dict, Any


def detect_volume_bursts(
    volumes: List[float],
    threshold_ratio: float = 1.5,
    min_interval: int = 1,
    include_values: bool = False
) -> List[Dict[str, Any]]:
    """
    Identify indices where volume jumps significantly compared to the previous value.

    Args:
        volumes: list of numeric volumes (floats)
        threshold_ratio: ratio threshold to trigger a burst (default 1.5)
        min_interval: minimum distance between detected bursts (default 1)
        include_values: include slice of recent values in result

    Returns:
        A list of dicts with burst details:
        {
            "index": int,
            "previous": float,
            "current": float,
            "ratio": float,
            "delta": float,
            "cumulative_avg": float,
            "values": Optional[List[float]]
        }
    """
    events: List[Dict[str, Any]] = []
    last_idx = -min_interval
    n = len(volumes)
    if n < 2:
        return events

    cumulative_sum = 0.0
    for i in range(n):
        cumulative_sum += volumes[i]
        if i == 0:
            continue

        prev, curr = volumes[i - 1], volumes[i]
        ratio = (curr / prev) if prev > 0 else float("inf")
        delta = curr - prev
        avg_so_far = cumulative_sum / (i + 1)

        if ratio >= threshold_ratio and (i - last_idx) >= min_interval:
            event: Dict[str, Any] = {
                "index": i,
                "previous": prev,
                "current": curr,
                "ratio": round(ratio, 4),
                "delta": round(delta, 4),
                "cumulative_avg": round(avg_so_far, 4),
            }
            if include_values:
                event["values"] = volumes[max(0, i - 3): i + 1]
            events.append(event)
            last_idx = i

    return events
