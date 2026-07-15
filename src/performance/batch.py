"""Batch processing for async operations"""
import asyncio
from typing import List, Callable, Any, TypeVar, Generic
from dataclasses import dataclass
from datetime import datetime

from src.core.logger import setup_logger

logger = setup_logger(__name__)

T = TypeVar('T')


@dataclass
class BatchJob(Generic[T]):
    """Represents a batch job"""
    id: str
    items: List[Any]
    total: int
    completed: int = 0
    failed: int = 0
    results: List[T] = None
    errors: List[str] = None
    started_at: datetime = None
    completed_at: datetime = None

    def __post_init__(self):
        if self.results is None:
            self.results = []
        if self.errors is None:
            self.errors = []
        if self.started_at is None:
            self.started_at = datetime.utcnow()

    def get_duration_seconds(self) -> float:
        """Get job duration in seconds"""
        end_time = self.completed_at or datetime.utcnow()
        return (end_time - self.started_at).total_seconds()

    def get_success_rate(self) -> float:
        """Get success rate percentage"""
        if self.total == 0:
            return 0.0
        return (self.completed / self.total) * 100


class BatchProcessor:
    """Process items in batches asynchronously"""

    def __init__(self, batch_size: int = 100, max_workers: int = 10):
        """
        Initialize batch processor

        Args:
            batch_size: Number of items per batch
            max_workers: Maximum concurrent workers
        """
        self.batch_size = batch_size
        self.max_workers = max_workers
        self.jobs = {}

    async def process_batch(
        self,
        job_id: str,
        items: List[Any],
        worker_func: Callable,
        *args,
        **kwargs
    ) -> BatchJob:
        """
        Process items in batches

        Args:
            job_id: Unique job identifier
            items: Items to process
            worker_func: Async function to call for each item
            *args: Additional positional arguments to pass to worker_func
            **kwargs: Additional keyword arguments to pass to worker_func

        Returns:
            BatchJob with results
        """
        job = BatchJob(
            id=job_id,
            items=items,
            total=len(items)
        )
        self.jobs[job_id] = job

        logger.info(
            f"Starting batch job {job_id}: {job.total} items, "
            f"batch_size={self.batch_size}, max_workers={self.max_workers}"
        )

        # Process in batches
        for batch_start in range(0, len(items), self.batch_size):
            batch_end = min(batch_start + self.batch_size, len(items))
            batch_items = items[batch_start:batch_end]

            # Process batch with concurrency limit
            tasks = []
            for item in batch_items:
                task = asyncio.create_task(
                    self._process_item(item, worker_func, args, kwargs)
                )
                tasks.append(task)

            # Wait for workers with limit
            while tasks:
                done, pending = await asyncio.wait(
                    tasks,
                    return_when=asyncio.FIRST_COMPLETED,
                    timeout=30
                )

                for completed_task in done:
                    success, result, error = await completed_task
                    if success:
                        job.results.append(result)
                        job.completed += 1
                    else:
                        job.errors.append(error)
                        job.failed += 1

                tasks = list(pending)

                # Limit concurrent workers
                if len(tasks) >= self.max_workers:
                    await asyncio.sleep(0.1)

        job.completed_at = datetime.utcnow()
        duration = job.get_duration_seconds()
        success_rate = job.get_success_rate()

        logger.info(
            f"Batch job {job_id} completed: "
            f"{job.completed} successful, {job.failed} failed, "
            f"duration={duration:.2f}s, success_rate={success_rate:.1f}%"
        )

        return job

    async def _process_item(
        self,
        item: Any,
        worker_func: Callable,
        args: tuple,
        kwargs: dict
    ) -> tuple:
        """Process a single item"""
        try:
            result = await worker_func(item, *args, **kwargs)
            return True, result, None
        except Exception as e:
            error_msg = f"Failed to process item: {str(e)}"
            logger.error(error_msg)
            return False, None, error_msg

    def get_job_status(self, job_id: str) -> dict:
        """Get status of a batch job"""
        job = self.jobs.get(job_id)
        if not job:
            return {"error": "Job not found"}

        return {
            "job_id": job_id,
            "total_items": job.total,
            "completed": job.completed,
            "failed": job.failed,
            "remaining": job.total - job.completed - job.failed,
            "success_rate": job.get_success_rate(),
            "duration_seconds": job.get_duration_seconds(),
            "started_at": job.started_at.isoformat(),
            "completed_at": job.completed_at.isoformat() if job.completed_at else None
        }

    def cleanup_old_jobs(self, hours: int = 24):
        """Clean up old completed jobs"""
        now = datetime.utcnow()
        to_delete = []

        for job_id, job in self.jobs.items():
            if job.completed_at and (now - job.completed_at).total_seconds() > hours * 3600:
                to_delete.append(job_id)

        for job_id in to_delete:
            del self.jobs[job_id]
            logger.debug(f"Cleaned up old job {job_id}")

        return len(to_delete)


# Global batch processor
_batch_processor: BatchProcessor = None


def get_batch_processor() -> BatchProcessor:
    """Get or create global batch processor"""
    global _batch_processor
    if _batch_processor is None:
        _batch_processor = BatchProcessor()
    return _batch_processor
