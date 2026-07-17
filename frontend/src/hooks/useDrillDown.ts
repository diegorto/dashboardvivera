import { useState, useCallback } from 'react';

export type DrillDownType =
  | 'leads-total'
  | 'leads-by-source'
  | 'sales-by-funnel'
  | 'conversion-time-channel'
  | 'no-shows-sdr'
  | 'no-shows-day'
  | 'response-speed-range'
  | 'response-speed-sdr'
  | 'lost-leads-channel'
  | 'lost-leads-objection'
  | null;

export interface DrillDownState {
  type: DrillDownType;
  metric?: string;
  data?: any;
  title?: string;
}

export const useDrillDown = () => {
  const [drillDown, setDrillDown] = useState<DrillDownState>({
    type: null,
  });

  const openDrillDown = useCallback(
    (type: DrillDownType, metric?: string, data?: any, title?: string) => {
      setDrillDown({
        type,
        metric,
        data,
        title,
      });
    },
    []
  );

  const closeDrillDown = useCallback(() => {
    setDrillDown({
      type: null,
    });
  }, []);

  return {
    drillDown,
    openDrillDown,
    closeDrillDown,
    isOpen: drillDown.type !== null,
  };
};
