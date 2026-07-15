"""Tests for performance metrics"""
import pytest
import time

from src.performance.metrics import OperationMetrics, MetricsCollector, track_performance, get_metrics_collector


class TestOperationMetrics:
    """Tests for OperationMetrics"""

    def test_operation_metrics_creation(self):
        """Test creating operation metrics"""
        metrics = OperationMetrics("test_op")
        assert metrics.operation_name == "test_op"
        assert metrics.call_count == 0
        assert metrics.error_count == 0

    def test_record_call(self):
        """Test recording operation calls"""
        metrics = OperationMetrics("test_op")
        metrics.record_call(10.5, success=True)
        metrics.record_call(20.3, success=True)

        assert metrics.call_count == 2
        assert metrics.error_count == 0
        assert len(metrics.durations) == 2

    def test_record_failed_call(self):
        """Test recording failed operations"""
        metrics = OperationMetrics("test_op")
        metrics.record_call(15.0, success=True)
        metrics.record_call(25.0, success=False)

        assert metrics.call_count == 2
        assert metrics.error_count == 1

    def test_min_max_duration(self):
        """Test min and max duration tracking"""
        metrics = OperationMetrics("test_op")
        metrics.record_call(100.0)
        metrics.record_call(50.0)
        metrics.record_call(200.0)

        assert metrics.min_duration_ms == 50.0
        assert metrics.max_duration_ms == 200.0

    def test_average_duration(self):
        """Test average duration calculation"""
        metrics = OperationMetrics("test_op")
        metrics.record_call(10.0)
        metrics.record_call(20.0)
        metrics.record_call(30.0)

        avg = metrics.get_average_duration_ms()
        assert avg == 20.0

    def test_error_rate(self):
        """Test error rate calculation"""
        metrics = OperationMetrics("test_op")
        metrics.record_call(10.0, success=True)
        metrics.record_call(20.0, success=True)
        metrics.record_call(30.0, success=False)

        error_rate = metrics.get_error_rate()
        assert error_rate == pytest.approx(33.33, 0.1)

    def test_get_stats(self):
        """Test getting all statistics"""
        metrics = OperationMetrics("test_op")
        metrics.record_call(10.0)
        metrics.record_call(20.0)

        stats = metrics.get_stats()
        assert stats["operation"] == "test_op"
        assert stats["call_count"] == 2
        assert "average_ms" in stats
        assert "min_ms" in stats
        assert "max_ms" in stats


class TestMetricsCollector:
    """Tests for MetricsCollector"""

    def test_collector_initialization(self):
        """Test initializing metrics collector"""
        collector = MetricsCollector()
        assert len(collector.metrics) == 0

    def test_record_operation(self):
        """Test recording operations"""
        collector = MetricsCollector()
        collector.record_operation("op1", 10.0)
        collector.record_operation("op1", 20.0)
        collector.record_operation("op2", 15.0)

        assert len(collector.metrics) == 2
        assert collector.metrics["op1"].call_count == 2
        assert collector.metrics["op2"].call_count == 1

    def test_get_operation_metrics(self):
        """Test getting metrics for specific operation"""
        collector = MetricsCollector()
        collector.record_operation("test_op", 25.0)

        metrics = collector.get_operation_metrics("test_op")
        assert metrics is not None
        assert metrics["call_count"] == 1

    def test_get_all_metrics(self):
        """Test getting all collected metrics"""
        collector = MetricsCollector()
        collector.record_operation("op1", 10.0)
        collector.record_operation("op2", 20.0)

        all_metrics = collector.get_all_metrics()
        assert "collected_at" in all_metrics
        assert "operations" in all_metrics
        assert len(all_metrics["operations"]) == 2

    def test_get_slowest_operations(self):
        """Test getting slowest operations"""
        collector = MetricsCollector()
        collector.record_operation("fast", 5.0)
        collector.record_operation("medium", 50.0)
        collector.record_operation("slow", 100.0)

        slowest = collector.get_slowest_operations(2)
        assert len(slowest) == 2
        assert slowest[0]["operation"] == "slow"
        assert slowest[1]["operation"] == "medium"

    def test_get_most_called_operations(self):
        """Test getting most called operations"""
        collector = MetricsCollector()
        for i in range(10):
            collector.record_operation("popular", 10.0)
        for i in range(3):
            collector.record_operation("unpopular", 20.0)

        most_called = collector.get_most_called_operations(1)
        assert most_called[0]["operation"] == "popular"
        assert most_called[0]["call_count"] == 10

    def test_get_error_operations(self):
        """Test getting operations with errors"""
        collector = MetricsCollector()
        collector.record_operation("success", 10.0, success=True)
        collector.record_operation("failure", 20.0, success=False)
        collector.record_operation("failure", 20.0, success=False)

        error_ops = collector.get_error_operations()
        assert len(error_ops) == 1
        assert error_ops[0]["operation"] == "failure"
        assert error_ops[0]["error_count"] == 2

    def test_reset(self):
        """Test resetting metrics"""
        collector = MetricsCollector()
        collector.record_operation("op1", 10.0)
        assert len(collector.metrics) == 1

        collector.reset()
        assert len(collector.metrics) == 0


class TestTrackPerformanceDecorator:
    """Tests for track_performance decorator"""

    def test_track_sync_function(self):
        """Test tracking sync function performance"""
        collector = MetricsCollector()

        @track_performance("sync_op")
        def sync_func(x, y):
            return x + y

        # Override global collector for testing
        import src.performance.metrics
        src.performance.metrics._metrics_collector = collector

        result = sync_func(1, 2)
        assert result == 3

        metrics = collector.get_operation_metrics("sync_op")
        assert metrics is not None
        assert metrics["call_count"] == 1
        assert metrics["error_count"] == 0

    @pytest.mark.asyncio
    async def test_track_async_function(self):
        """Test tracking async function performance"""
        collector = MetricsCollector()

        @track_performance("async_op")
        async def async_func(x, y):
            return x * y

        # Override global collector for testing
        import src.performance.metrics
        src.performance.metrics._metrics_collector = collector

        result = await async_func(3, 4)
        assert result == 12

        metrics = collector.get_operation_metrics("async_op")
        assert metrics is not None
        assert metrics["call_count"] == 1

    def test_track_failed_operation(self):
        """Test tracking failed operations"""
        collector = MetricsCollector()

        @track_performance("failing_op")
        def failing_func():
            raise ValueError("Test error")

        # Override global collector for testing
        import src.performance.metrics
        src.performance.metrics._metrics_collector = collector

        with pytest.raises(ValueError):
            failing_func()

        metrics = collector.get_operation_metrics("failing_op")
        assert metrics["call_count"] == 1
        assert metrics["error_count"] == 1


class TestGlobalMetricsCollector:
    """Tests for global metrics collector"""

    def test_get_metrics_collector_singleton(self):
        """Test that get_metrics_collector returns same instance"""
        collector1 = get_metrics_collector()
        collector2 = get_metrics_collector()
        assert collector1 is collector2
