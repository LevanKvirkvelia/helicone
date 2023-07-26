import { EllipsisVerticalIcon } from "@heroicons/react/24/outline";
import { RenderAreaChart } from "../../../shared/metrics/areaChart";
import { BarChartData, RenderBarChart } from "../../../shared/metrics/barChart";
import {
  DoubleAreaChartData,
  RenderDoubleAreaChart,
} from "../../../shared/metrics/doubleAreaChart";

interface MainGraphProps {
  isLoading: boolean;
  dataOverTime: BarChartData[];
  doubleLineOverTime?: DoubleAreaChartData[];
  timeMap: (date: Date) => string;
  title: string;
  value: string | number;
  valueLabel: string;
  type: "double-line" | "bar" | "area";
}

export default function MainGraph(props: MainGraphProps) {
  const {
    isLoading,
    dataOverTime,
    doubleLineOverTime,
    timeMap,
    title,
    value,
    valueLabel,
    type,
  } = props;

  return (
    <div className="col-span-2 xl:col-span-1 h-full">
      <div className="bg-white border border-gray-300 rounded-lg px-4 pt-4 shadow-md">
        <div className="flex flex-col">
          <div className="flex flex-row w-full justify-between items-start">
            <div className="flex flex-col space-y-0.5">
              <p className="text-sm text-gray-700">{title}</p>
              <h3 className="text-xl font-semibold text-gray-900">{value}</h3>
            </div>
            <EllipsisVerticalIcon className="h-6 w-6 text-gray-500" />
          </div>
          <div className="h-40">
            {isLoading ? (
              <div className="h-full w-full flex-col flex p-8">
                <div className="h-full w-full rounded-lg bg-gray-300 animate-pulse" />
              </div>
            ) : type === "bar" ? (
              <RenderBarChart
                data={dataOverTime}
                timeMap={timeMap}
                valueLabel={valueLabel}
              />
            ) : type === "area" ? (
              <RenderAreaChart
                data={dataOverTime}
                timeMap={timeMap}
                valueLabel={valueLabel}
              />
            ) : type === "double-line" && doubleLineOverTime ? (
              <RenderDoubleAreaChart
                data={doubleLineOverTime}
                timeMap={timeMap}
                valueLabel1={valueLabel}
                valueLabel2={"errors"}
              />
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
