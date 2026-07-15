"""Performance metrics and monitoring"""
import time
from datetime import datetime, timedelta
from typing import Dict, List, Optional
from dataclasses import dataclass, field
from statistics import mean, median, stdev

from src.core.logger import setup_logger

logger = setup_logger(__name__)


@dataclass
class OperationMetrics:
    """Metrics for an operation type"""
    operation_name: str
    call_count: int = 0
    total_duration_ms: float = 0.0
    min_duration_ms: float = float('inf')
    max_duration_ms: float = 0.0
    error_count: int = 0
    durations: List[float] = field(default_factory=list)

    def record_call(self, duration_ms: float, success: bool = True):
        """Record a call to this operation"""
        self.call_count += 1
        self.total_duration_ms += duration_ms
        self.min_duration_ms = min(self.min_duration_ms, duration_ms)
        self.max_duration_ms = max(self.max_duration_ms, duration_ms)
        self.durations.append(duration_ms)

        if not success:
            self.error_count += 1

    def get_average_duration_ms(self) -> float:
        """Get average duration in milliseconds"""
        if self.call_count == 0:
            return 0.0
        return self.total_duration_ms / self.call_count

    def get_median_duration_ms(self) -> float:
        """Get median duration in milliseconds"""
        if not self.durations:
            return 0.0
        return median(self.durations)

    def get_stddev_duration_ms(self) -> float:
        """Get standard deviation of duration"""
        if len(self.durations) < 2:
            return 0.0
        return stdev(self.durations)

    def get_error_rate(self) -> float:
        """Get error rate percentage"""
        if self.call_count == 0:
            return 0.0
        return (self.error_count / self.call_count) * 100

    def get_stats(self) -> dict:
        """Get all statistics as dictionary"""
        return {
            "operation": self.operation_name,
            "call_count": self.call_count,
            "error_count": self.error_count,
            "error_rate_percent": self.get_error_rate(),
            "min_ms": round(self.min_duration_ms, 2),
            "max_ms": round(self.max_duration_ms, 2),
            "average_ms": round(self.get_average_duration_ms(), 2),
            "median_ms": round(self.get_median_duration_ms(), 2),
            "stddev_ms": round(self.get_stddev_duration_ms(), 2)
        }


class MetricsCollector:
    """Collects and reports performance metrics"""

    def __init__(self):
        self.metrics: Dict[str, OperationMetrics] = {}
        self.created_at = datetime.utcnow()

    def record_operation(
        self,
        operation_name: str,
        duration_ms: float,
        success: bool = True
    ):
        """Record an operation's metrics"""
        if operation_name not in self.metrics:
            self.metrics[operation_name] = OperationMetrics(operation_name)

        self.metrics[operation_name].record_call(duration_ms, success)

    def get_operation_metrics(self, operation_name: str) -> Optional[dict]:
        """Get metrics for a specific operation"""
        if operation_name not in self.metrics:
            return None

        return self.metrics[operation_name].get_stats()

    def get_all_metrics(self) -> dict:
        """Get all collected metrics"""
        return {
            "collected_at": datetime.utcnow().isoformat(),
            "uptime_seconds": (datetime.utcnow() - self.created_at).total_seconds(),
            "operations": {
                name: metrics.get_stats()
                for name, metrics in self.metrics.items()
            }
        }

    def get_slowest_operations(self, count: int = 5) -> List[dict]:
        """Get slowest operations by average duration"""
        sorted_ops = sorted(
            self.metrics.values(),
            key=lambda m: m.get_average_duration_ms(),
            reverse=True
        )
        return [m.get_stats() for m in sorted_ops[:count]]

    def get_most_called_operations(self, count: int = 5) -> List[dict]:
        """Get most frequently called operations"""
        sorted_ops = sorted(
            self.metrics.values(),
            key=lambda m: m.call_count,
            reverse=True
        )
        return [m.get_stats() for m in sorted_ops[:count]]

    def get_error_operations(self) -> List[dict]:
        """Get operations with errors"""
        error_ops = [m for m in self.metrics.values() if m.error_count > 0]
        return [m.get_stats() for m in error_ops]

    def reset(self):
        """Reset all metrics"""
        self.metrics.clear()
        self.created_at = datetime.utcnow()
        logger.info("Metrics reset")

    def log_summary(self):
        """Log metrics summary"""
        metrics = self.get_all_metrics()
        logger.info(f"Performance metrics: {len(metrics['operations'])} operations tracked")
        logger.info(f"Slowest operations: {self.get_slowest_operations(3)}")


# Global metrics collector
_metrics_collector: MetricsCollector = None


def get_metrics_collector() -> MetricsCollector:
    """Get or create global metrics collector"""
    global _metrics_collector
    if _metrics_collector is None:
        _metrics_collector = MetricsCollector()
    return _metrics_collector


def track_performance(operation_name: str):
    """
    Decorator to track operation performance

    Example:
        @track_performance("fuzzy_match")
        async def fuzzy_match_patient(clairis_id, phone):
            ...
    """
    def decorator(func):
        async def async_wrapper(*args, **kwargs):
            start_time = time.time()
            try:
                result = await func(*args, **kwargs)
                duration_ms = (time.time() - start_time) * 1000
                get_metrics_collector().record_operation(operation_name, duration_ms, True)
                return result
            except Exception as e:
                duration_ms = (time.time() - start_time) * 1000
                get_metrics_collector().record_operation(operation_name, duration_ms, False)
                raise

        def sync_wrapper(*args, **kwargs):
            start_time = time.time()
            try:
                result = func(*args, **kwargs)
                duration_ms = (time.time() - start_time) * 1000
                get_metrics_collector().record_operation(operation_name, duration_ms, True)
                return result
            except Exception as e:
                duration_ms = (time.time() - start_time) * 1000
                get_metrics_collector().record_operation(operation_name, duration_ms, False)
                raise

        import inspect
        if inspect.iscoroutinefunction(func):
            return async_wrapper
        else:
            return sync_wrapper

    return decorator
