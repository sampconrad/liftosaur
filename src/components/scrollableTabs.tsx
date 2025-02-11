import { h, JSX, ComponentChildren } from "preact";
import { StringUtils } from "../utils/string";
import { useState } from "preact/hooks";
import { Scroller } from "./scroller";

interface IProps {
  tabs: {
    label: string;
    children: ComponentChildren;
    isInvalid?: boolean;
  }[];
  defaultIndex?: number;
}

export function ScrollableTabs(props: IProps): JSX.Element {
  const { tabs } = props;
  const [selectedIndex, setSelectedIndex] = useState<number>(props.defaultIndex || 0);

  return (
    <div className="relative">
      {tabs.length > 1 && (
        <div className="sticky top-0 left-0 z-10 bg-white" style={{ marginLeft: "-1rem", marginRight: "-1rem" }}>
          <Scroller arrowYOffsetPct={-20}>
            <div className="flex w-full py-2">
              {tabs.map(({ label, isInvalid }, index) => {
                const nameClass = `tab-${StringUtils.dashcase(label.toLowerCase())}`;

                return (
                  <div className="flex-1 text-center whitespace-no-wrap border-b border-grayv2-50">
                    <button
                      className={`ls-${nameClass} inline-block text-base px-4 pb-1 outline-none focus:outline-none ${
                        selectedIndex === index ? "text-orangev2 border-b border-orangev2" : ""
                      } ${isInvalid ? " text-redv2-main" : ""} nm-tab-${nameClass}`}
                      style={selectedIndex === index ? { borderBottomWidth: "2px" } : {}}
                      data-cy={nameClass}
                      onClick={() => setSelectedIndex(index)}
                    >
                      {isInvalid ? " ⚠️" : ""}
                      {label}
                    </button>
                  </div>
                );
              })}
            </div>
          </Scroller>
        </div>
      )}
      {tabs[selectedIndex]?.children || tabs[0]?.children}
    </div>
  );
}
