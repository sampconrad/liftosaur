import { IGThunk } from "../ducks/types";
import { useThunkReducer } from "./useThunkReducer";
import { ILensRecordingPayload } from "lens-shmens";
import { useCallback } from "preact/hooks";
import { UrlUtils } from "./url";

type IAction<TState> = {
  type: "Update";
  lensRecording: ILensRecordingPayload<TState>[];
  desc?: string;
};

export type ILensDispatchSimple<TState> = (lensRecording: ILensRecordingPayload<TState>, desc?: string) => void;

export type ILensDispatch<TState> = (
  lensRecording: ILensRecordingPayload<TState> | ILensRecordingPayload<TState>[],
  desc?: string
) => void | Promise<void>;

const isLoggingEnabled =
  typeof window !== "undefined" && window?.location
    ? !!UrlUtils.build(window.location.href).searchParams.get("log")
    : false;

export function useLensReducer<TState, TEnv>(
  initialState: TState,
  env: TEnv,
  onActions: Array<
    (
      action: IAction<TState> | IGThunk<TState, IAction<TState>, TEnv>,
      oldState: TState,
      newState: TState
    ) => void | Promise<void>
  > = []
): [TState, ILensDispatch<TState>] {
  const [hookState, thunkDispatch] = useThunkReducer(
    (state, action) => {
      if (isLoggingEnabled) {
        console.log(`%c-------${action.desc ? ` ${action.desc}` : ""}`, "font-weight:bold");
      }
      return action.lensRecording.reduce((memo, recording) => {
        if (isLoggingEnabled) {
          recording.log("state");
        }
        const newState = recording.fn(memo);
        if (isLoggingEnabled && recording.type === "modify") {
          console.log("New Value: ", recording.value.v);
        }
        return newState;
      }, state);
    },
    initialState,
    env,
    onActions
  );

  const dispatch = useCallback(
    (
      lensRecording: ILensRecordingPayload<TState>[] | ILensRecordingPayload<TState>,
      desc?: string
    ): void | Promise<void> => {
      if (!Array.isArray(lensRecording)) {
        lensRecording = [lensRecording];
      }
      return thunkDispatch({ type: "Update", lensRecording, desc });
    },
    [thunkDispatch]
  );

  return [hookState, dispatch];
}
