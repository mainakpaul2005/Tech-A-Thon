import math
import random
from dataclasses import dataclass
from typing import Iterable, List, Optional, Sequence, Tuple


@dataclass(frozen=True)
class Bin:
    bin_id: str
    x: float
    y: float
    fullness: float


@dataclass(frozen=True)
class RouteStep:
    step: int
    bin_id: str
    position: Tuple[float, float]
    fullness: float
    distance_from_prev: float
    score: float


def euclidean_distance(a: Tuple[float, float], b: Tuple[float, float]) -> float:
    return math.hypot(a[0] - b[0], a[1] - b[1])


def generate_bins(
    count: int,
    seed: Optional[int] = None,
    x_range: Tuple[int, int] = (0, 100),
    y_range: Tuple[int, int] = (0, 100),
    fullness_range: Tuple[int, int] = (20, 100),
) -> List[Bin]:
    rng = random.Random(seed)
    bins: List[Bin] = []
    for i in range(1, count + 1):
        bins.append(
            Bin(
                bin_id=f"BIN-{i}",
                x=rng.randint(*x_range),
                y=rng.randint(*y_range),
                fullness=rng.randint(*fullness_range),
            )
        )
    return bins


def update_bin_fullness(bins: Sequence[Bin], bin_id: str, new_fullness: float) -> List[Bin]:
    updated: List[Bin] = []
    for b in bins:
        if b.bin_id == bin_id:
            updated.append(Bin(bin_id=b.bin_id, x=b.x, y=b.y, fullness=float(new_fullness)))
        else:
            updated.append(b)
    return updated


def simulate_accumulation(
    bins: Sequence[Bin],
    min_increase: int = 1,
    max_increase: int = 10,
    seed: Optional[int] = None,
) -> List[Bin]:
    rng = random.Random(seed)
    updated: List[Bin] = []
    for b in bins:
        increment = rng.randint(min_increase, max_increase)
        updated.append(
            Bin(
                bin_id=b.bin_id,
                x=b.x,
                y=b.y,
                fullness=min(100.0, b.fullness + increment),
            )
        )
    return updated


def optimize_route_greedy(
    bins: Iterable[Bin],
    depot: Tuple[float, float] = (0.0, 0.0),
    min_fullness: float = 40.0,
) -> Tuple[List[RouteStep], float, float]:
    remaining = [b for b in bins if b.fullness >= min_fullness]
    route: List[RouteStep] = []
    total_distance = 0.0
    total_fullness = 0.0
    current = depot
    step = 1

    while remaining:
        best_bin: Optional[Bin] = None
        best_score = -1.0
        best_distance = 0.0

        for b in remaining:
            distance = euclidean_distance(current, (b.x, b.y))
            safe_distance = max(distance, 0.1)
            score = b.fullness / safe_distance
            if score > best_score:
                best_bin = b
                best_score = score
                best_distance = distance

        if best_bin is None:
            break

        route.append(
            RouteStep(
                step=step,
                bin_id=best_bin.bin_id,
                position=(best_bin.x, best_bin.y),
                fullness=best_bin.fullness,
                distance_from_prev=best_distance,
                score=best_score,
            )
        )
        total_distance += best_distance
        total_fullness += best_bin.fullness
        current = (best_bin.x, best_bin.y)
        remaining = [b for b in remaining if b.bin_id != best_bin.bin_id]
        step += 1

    return route, total_distance, total_fullness


def print_bins(bins: Sequence[Bin]) -> None:
    for b in bins:
        print(f" - {b.bin_id}: {b.fullness:.0f}% at ({b.x}, {b.y})")


def print_route(route: Sequence[RouteStep], total_distance: float, total_fullness: float) -> None:
    if not route:
        print("No bins meet the minimum fullness threshold.")
        return

    for step in route:
        print(
            "Step {step}: {bin_id} at ({x}, {y}) | "
            "Fullness={fullness:.0f}% | Dist={dist:.1f} | Score={score:.2f}".format(
                step=step.step,
                bin_id=step.bin_id,
                x=int(step.position[0]),
                y=int(step.position[1]),
                fullness=step.fullness,
                dist=step.distance_from_prev,
                score=step.score,
            )
        )

    print(f"Total distance: {total_distance:.1f}")
    print(f"Total fullness collected: {total_fullness:.0f}%")


def plot_route(
    bins: Sequence[Bin],
    route: Sequence[RouteStep],
    depot: Tuple[float, float] = (0.0, 0.0),
    title: str = "Optimized Waste Collection Route",
) -> None:
    try:
        import matplotlib.pyplot as plt
    except ImportError:
        print("Matplotlib not installed. Skipping plot.")
        return

    xs = [b.x for b in bins]
    ys = [b.y for b in bins]
    colors = [b.fullness for b in bins]

    plt.figure(figsize=(8, 6))
    scatter = plt.scatter(xs, ys, c=colors, cmap="viridis", s=80, edgecolors="black")
    plt.colorbar(scatter, label="Fullness (%)")

    plt.scatter([depot[0]], [depot[1]], marker="s", s=120, c="red", label="Depot")
    for b in bins:
        plt.text(b.x + 1, b.y + 1, b.bin_id, fontsize=8)

    if route:
        path_x = [depot[0]] + [step.position[0] for step in route]
        path_y = [depot[1]] + [step.position[1] for step in route]
        plt.plot(path_x, path_y, linestyle="--", color="gray", linewidth=2, label="Route")

    plt.title(title)
    plt.xlabel("X")
    plt.ylabel("Y")
    plt.legend(loc="upper right")
    plt.tight_layout()
    plt.show()


def run_simulation(
    bins: Sequence[Bin],
    depot: Tuple[float, float] = (0.0, 0.0),
    min_fullness: float = 40.0,
    cycles: int = 3,
) -> None:
    current_bins = list(bins)

    for cycle in range(1, cycles + 1):
        print(f"\n=== Cycle {cycle} ===")
        print("Current bin status:")
        print_bins(current_bins)

        route, total_distance, total_fullness = optimize_route_greedy(
            current_bins, depot=depot, min_fullness=min_fullness
        )
        print("\nRoute:")
        print_route(route, total_distance, total_fullness)

        if cycle < cycles:
            current_bins = simulate_accumulation(current_bins)

    plot_route(current_bins, route, depot=depot)


if __name__ == "__main__":
    depot_location = (0.0, 0.0)
    min_fullness_threshold = 40.0

    bins = generate_bins(count=8, seed=7)

    sensor_bin_id = "BIN-3"
    sensor_fullness = 95
    bins = update_bin_fullness(bins, sensor_bin_id, sensor_fullness)

    print("Initialized bins (1 real sensor + simulated bins):")
    print_bins(bins)

    run_simulation(
        bins,
        depot=depot_location,
        min_fullness=min_fullness_threshold,
        cycles=3,
    )
