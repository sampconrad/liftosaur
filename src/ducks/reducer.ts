import { Reducer } from "preact/hooks";
import { Program } from "../models/program";
import { Progress } from "../models/progress";
import { StateError } from "./stateError";
import { History } from "../models/history";
import { Storage } from "../models/storage";
import { Screen, IScreen } from "../models/screen";
import deepmerge from "deepmerge";
import { CollectionUtils } from "../utils/collection";
import { ILensRecordingPayload, lf } from "lens-shmens";
import { getLatestMigrationVersion } from "../migrations/migrations";
import { ILocalStorage, INotification, IState, IStateErrors } from "../models/state";
import { UidFactory } from "../utils/generator";
import {
  THistoryRecord,
  IStorage,
  IExerciseType,
  IWeight,
  IProgressMode,
  ISettings,
  IHistoryRecord,
  IProgram,
  IProgramExercise,
} from "../types";
import { IndexedDBUtils } from "../utils/indexeddb";
import { Equipment } from "../models/equipment";
import { basicBeginnerProgram } from "../programs/basicBeginnerProgram";
import { LogUtils } from "../utils/log";
import { ProgramExercise } from "../models/programExercise";
import { Service } from "../api/service";
import { unrunMigrations } from "../migrations/runner";
import { ObjectUtils } from "../utils/object";
import { UrlUtils } from "../utils/url";
import { DateUtils } from "../utils/date";

const isLoggingEnabled =
  typeof window !== "undefined" && window?.location
    ? !!UrlUtils.build(window.location.href).searchParams.get("log")
    : false;
const shouldSkipIntro =
  typeof window !== "undefined" && window?.location
    ? !!UrlUtils.build(window.location.href).searchParams.get("skipintro")
    : false;

export async function getIdbKey(userId?: string, isAdmin?: boolean): Promise<string> {
  const currentAccount = await IndexedDBUtils.get("current_account");
  if (currentAccount) {
    return `liftosaur_${currentAccount}`;
  } else {
    return userId != null && isAdmin ? `liftosaur_${userId}` : "liftosaur";
  }
}

export async function getInitialState(
  client: Window["fetch"],
  args?: { url?: URL; rawStorage?: string; storage?: IStorage }
): Promise<IState> {
  const url = args?.url || UrlUtils.build(document.location.href);
  const userId = url.searchParams.get("userid") || undefined;
  const messageerror = url.searchParams.get("messageerror") || undefined;
  const messagesuccess = url.searchParams.get("messagesuccess") || undefined;
  let storage: ILocalStorage | undefined;
  if (args?.storage) {
    storage = { storage: args.storage };
  } else if (args?.rawStorage != null) {
    try {
      storage = JSON.parse(args.rawStorage);
    } catch (e) {
      storage = undefined;
    }
  }
  const notification: INotification | undefined =
    messageerror || messagesuccess
      ? {
          type: messageerror ? ("error" as const) : ("success" as const),
          content: messageerror || messagesuccess || "",
        }
      : undefined;

  if (storage != null && storage.storage != null) {
    const hasUnrunMigrations = unrunMigrations(storage.storage).length > 0;
    const maybeStorage = await Storage.get(client, storage.storage, true);
    let finalStorage: IStorage;
    const errors: IStateErrors = {};
    if (maybeStorage.success) {
      finalStorage = maybeStorage.data;
    } else {
      const userid = (storage.storage?.tempUserId || `missing-${UidFactory.generateUid(8)}`) as string;
      const service = new Service(client);
      errors.corruptedstorage = {
        userid,
        backup: await service.postDebug(userid, JSON.stringify(storage.storage), { local: "true" }),
        confirmed: false,
        local: true,
      };
      await service.signout();
      finalStorage = Storage.getDefault();
    }
    const isProgressValid =
      storage.progress != null
        ? Storage.validateAndReport(storage.progress, THistoryRecord, "progress").success
        : false;

    const screenStack: IScreen[] = finalStorage.currentProgramId
      ? ["main"]
      : shouldSkipIntro
      ? ["programs"]
      : ["first"];
    return {
      storage: finalStorage,
      progress: isProgressValid ? { 0: storage.progress } : {},
      allFriends: { friends: {}, sortedIds: [], isLoading: false },
      friendsHistory: {},
      likes: { likes: {}, isLoading: false },
      notification,
      loading: { items: {} },
      programs: [basicBeginnerProgram],
      currentHistoryRecord: 0,
      comments: { comments: {}, isLoading: false, isPosting: false, isRemoving: {} },
      screenStack,
      user: userId ? { email: userId, id: userId } : undefined,
      freshMigrations: maybeStorage.success && hasUnrunMigrations,
      errors,
      nosync: false,
    };
  }
  const newState: IState = {
    screenStack: [shouldSkipIntro ? "programs" : "first"],
    progress: {},
    programs: [basicBeginnerProgram],
    loading: { items: {} },
    allFriends: { friends: {}, sortedIds: [], isLoading: false },
    likes: { likes: {}, isLoading: false },
    friendsHistory: {},
    notification,
    comments: { comments: {}, isLoading: false, isPosting: false, isRemoving: {} },
    storage: Storage.getDefault(),
    user: userId ? { email: userId, id: userId } : undefined,
    errors: {},
    freshMigrations: false,
    nosync: false,
  };
  LogUtils.log(newState.storage.tempUserId, "ls-initialize-user", {}, [], () => undefined);
  return newState;
}

export type IChangeDate = {
  type: "ChangeDate";
  date: string;
};

export type IConfirmDate = {
  type: "ConfirmDate";
  date?: string;
};

export type ISyncStorage = {
  type: "SyncStorage";
  storage: IStorage;
};

export type ILoginAction = {
  type: "Login";
  email: string;
  userId: string;
};

export type ILogoutAction = {
  type: "Logout";
};

export type IPushScreen = {
  type: "PushScreen";
  screen: IScreen;
};

export type IPullScreen = {
  type: "PullScreen";
};

export type ICancelProgress = {
  type: "CancelProgress";
};

export type IDeleteProgress = {
  type: "DeleteProgress";
};

export type IChangeRepsAction = {
  type: "ChangeRepsAction";
  entryIndex: number;
  setIndex: number;
  programExercise?: IProgramExercise;
  allProgramExercises?: IProgramExercise[];
  mode: IProgressMode;
};

export type IFinishProgramDayAction = {
  type: "FinishProgramDayAction";
};

export type IStartProgramDayAction = {
  type: "StartProgramDayAction";
};

export type IChangeAMRAPAction = {
  type: "ChangeAMRAPAction";
  amrapValue?: number;
  rpeValue?: number;
  isAmrap?: boolean;
  logRpe?: boolean;
  programExerciseId?: string;
  userVars?: Record<string, number | IWeight>;
};

export type IChangeWeightAction = {
  type: "ChangeWeightAction";
  weight: IWeight;
  exercise: IExerciseType;
  programExercise?: IProgramExercise;
};

export type IConfirmWeightAction = {
  type: "ConfirmWeightAction";
  weight?: IWeight;
  programExercise?: IProgramExercise;
};

export type IUpdateSettingsAction = {
  type: "UpdateSettings";
  lensRecording: ILensRecordingPayload<ISettings>;
};

export type IUpdateStateAction = {
  type: "UpdateState";
  lensRecording: ILensRecordingPayload<IState>[];
  desc?: string;
};

export type IReplaceStateAction = {
  type: "ReplaceState";
  state: IState;
};

export type IEditHistoryRecordAction = {
  type: "EditHistoryRecord";
  userId?: string;
  historyRecord: IHistoryRecord;
};

export type IStartTimer = {
  type: "StartTimer";
  timestamp: number;
  mode: IProgressMode;
  entryIndex: number;
  setIndex: number;
  timer?: number;
};

export type IStopTimer = {
  type: "StopTimer";
};

export type ICreateProgramAction = {
  type: "CreateProgramAction";
  name: string;
};

export type ICreateDayAction = {
  type: "CreateDayAction";
  weekIndex?: number;
};

export type IEditDayAction = {
  type: "EditDayAction";
  index: number;
};

export type IApplyProgramChangesToProgress = {
  type: "ApplyProgramChangesToProgress";
  programExerciseIds?: string[];
  checkReused?: boolean;
};

export type IUpdateProgressAction = {
  type: "UpdateProgress";
  lensRecordings: ILensRecordingPayload<IHistoryRecord>[];
};

export type ICardsAction =
  | IChangeRepsAction
  | IChangeWeightAction
  | IChangeAMRAPAction
  | IConfirmWeightAction
  | IUpdateProgressAction;

export type IAction =
  | ICardsAction
  | IStartProgramDayAction
  | IFinishProgramDayAction
  | IEditHistoryRecordAction
  | ICancelProgress
  | IDeleteProgress
  | IPushScreen
  | IPullScreen
  | ISyncStorage
  | IChangeDate
  | IConfirmDate
  | ILoginAction
  | ILogoutAction
  | IStartTimer
  | IStopTimer
  | IUpdateStateAction
  | IReplaceStateAction
  | IUpdateSettingsAction
  | ICreateProgramAction
  | ICreateDayAction
  | IEditDayAction
  | IApplyProgramChangesToProgress;

let timerId: number | undefined = undefined;

export const reducerWrapper: Reducer<IState, IAction> = (state, action) => {
  window.reducerLastState = state;
  window.reducerLastActions = [
    { ...action, time: DateUtils.formatHHMMSS(Date.now(), true) },
    ...(window.reducerLastActions || []).slice(0, 30),
  ];
  const newState = reducer(state, action);
  if (state.storage !== newState.storage) {
    newState.storage = {
      ...newState.storage,
      id: (newState.storage.id || 0) + 1,
      version: getLatestMigrationVersion(),
    };
  }
  if (timerId != null) {
    window.clearTimeout(timerId);
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).state = newState;
  if (newState.errors.corruptedstorage == null) {
    timerId = window.setTimeout(async () => {
      clearTimeout(timerId);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const newState2: IState = (window as any).state;
      timerId = undefined;
      const userId = newState2.user?.id || newState.storage.tempUserId;
      const localStorage: ILocalStorage = {
        storage: newState2.storage,
        progress: newState2.progress[0],
      };
      try {
        await IndexedDBUtils.set("current_account", userId);
        await IndexedDBUtils.set(`liftosaur_${userId}`, JSON.stringify(localStorage));
      } catch (e) {
        console.error(e);
      }
    }, 100);
  }
  return newState;
};

export function buildCardsReducer(settings: ISettings): Reducer<IHistoryRecord, ICardsAction> {
  return (progress, action): IHistoryRecord => {
    switch (action.type) {
      case "ChangeRepsAction": {
        const hasUserPromptedVars =
          action.programExercise &&
          action.allProgramExercises &&
          ProgramExercise.hasUserPromptedVars(action.programExercise, action.allProgramExercises);

        let newProgress = Progress.updateRepsInExercise(
          progress,
          action.entryIndex,
          action.setIndex,
          action.mode,
          !!hasUserPromptedVars
        );
        if (Progress.isFullyFinishedSet(newProgress)) {
          newProgress = Progress.stopTimer(newProgress);
        }
        return newProgress;
      }
      case "ChangeAMRAPAction": {
        progress = Progress.updateAmrapRepsInExercise(progress, action.amrapValue, action.isAmrap);
        if (action.logRpe) {
          progress = Progress.updateRpeInExercise(progress, action.rpeValue);
        }
        if (ObjectUtils.keys(action.userVars || {}).length > 0 && action.programExerciseId != null) {
          progress = Progress.updateUserPromptedStateVars(progress, action.programExerciseId, action.userVars || {});
        }
        if (Progress.isFullyFinishedSet(progress)) {
          progress = Progress.stopTimer(progress);
        }
        return { ...progress, ui: { ...progress.ui, amrapModal: undefined } };
      }
      case "ChangeWeightAction": {
        return Progress.showUpdateWeightModal(progress, action.exercise, action.weight, action.programExercise);
      }
      case "ConfirmWeightAction": {
        return Progress.updateWeight(progress, settings, action.weight, action.programExercise);
      }
      case "UpdateProgress": {
        return action.lensRecordings.reduce((memo, recording) => recording.fn(memo), progress);
      }
    }
  };
}

export const reducer: Reducer<IState, IAction> = (state, action): IState => {
  if (action.type === "ChangeRepsAction") {
    return Progress.setProgress(state, buildCardsReducer(state.storage.settings)(Progress.getProgress(state)!, action));
  } else if (action.type === "ChangeAMRAPAction") {
    return Progress.setProgress(state, buildCardsReducer(state.storage.settings)(Progress.getProgress(state)!, action));
  } else if (action.type === "ChangeWeightAction") {
    return Progress.setProgress(state, buildCardsReducer(state.storage.settings)(Progress.getProgress(state)!, action));
  } else if (action.type === "ConfirmWeightAction") {
    return Progress.setProgress(state, buildCardsReducer(state.storage.settings)(Progress.getProgress(state)!, action));
  } else if (action.type === "UpdateProgress") {
    return Progress.setProgress(state, buildCardsReducer(state.storage.settings)(Progress.getProgress(state)!, action));
  } else if (action.type === "StartProgramDayAction") {
    const progress = state.progress[0];
    if (progress != null) {
      return {
        ...state,
        currentHistoryRecord: progress.id,
        currentHistoryRecordUserId: undefined,
        screenStack:
          Screen.current(state.screenStack) !== "progress"
            ? Screen.push(state.screenStack, "progress")
            : state.screenStack,
      };
    } else if (state.storage.currentProgramId != null) {
      // TODO: What if the program is missing?
      const program = state.storage.programs.find((p) => p.id === state.storage.currentProgramId)!;
      const newProgress = Program.nextProgramRecord(program, state.storage.settings);
      return {
        ...state,
        currentHistoryRecord: 0,
        currentHistoryRecordUserId: undefined,
        screenStack: Screen.push(state.screenStack, "progress"),
        progress: { ...state.progress, 0: newProgress },
      };
    } else {
      return state;
    }
  } else if (action.type === "EditHistoryRecord") {
    return {
      ...state,
      currentHistoryRecord: action.historyRecord.id,
      currentHistoryRecordUserId: action.userId,
      screenStack: Screen.push(state.screenStack, "progress"),
      progress: { ...state.progress, [action.historyRecord.id]: action.historyRecord },
    };
  } else if (action.type === "FinishProgramDayAction") {
    const settings = state.storage.settings;
    const progress = Progress.getProgress(state);
    if (progress == null) {
      throw new StateError("FinishProgramDayAction: no progress");
    } else {
      const programIndex = state.storage.programs.findIndex((p) => p.id === progress.programId)!;
      const program = state.storage.programs[programIndex];
      Progress.stopTimer(progress);
      const historyRecord = History.finishProgramDay(progress, state.storage.settings, program);
      let newHistory;
      if (!Progress.isCurrent(progress)) {
        newHistory = state.storage.history.map((h) => (h.id === progress.id ? historyRecord : h));
      } else {
        newHistory = [historyRecord, ...state.storage.history];
      }
      const newProgram =
        Progress.isCurrent(progress) && program != null
          ? Program.runAllFinishDayScripts(program, progress, settings)
          : program;
      const newPrograms =
        newProgram != null ? lf(state.storage.programs).i(programIndex).set(newProgram) : state.storage.programs;
      return {
        ...state,
        storage: {
          ...state.storage,
          history: newHistory,
          programs: newPrograms,
        },
        screenStack: Progress.isCurrent(progress) ? ["finishDay"] : Screen.pull(state.screenStack),
        currentHistoryRecord: undefined,
        progress: Progress.stop(state.progress, progress.id),
      };
    }
  } else if (action.type === "ChangeDate") {
    return Progress.setProgress(state, Progress.showUpdateDate(Progress.getProgress(state)!, action.date));
  } else if (action.type === "ConfirmDate") {
    return Progress.setProgress(state, Progress.changeDate(Progress.getProgress(state)!, action.date));
  } else if (action.type === "CancelProgress") {
    const progress = Progress.getProgress(state)!;
    return {
      ...state,
      currentHistoryRecord: undefined,
      screenStack: Screen.pull(state.screenStack),
      progress: Progress.isCurrent(progress)
        ? state.progress
        : Progress.stop(state.progress, state.currentHistoryRecord!),
    };
  } else if (action.type === "DeleteProgress") {
    const progress = Progress.getProgress(state);
    if (progress != null) {
      const history = state.storage.history.filter((h) => h.id !== progress.id);
      return {
        ...state,
        currentHistoryRecord: undefined,
        screenStack: Screen.pull(state.screenStack),
        storage: { ...state.storage, history },
        progress: Progress.stop(state.progress, progress.id),
      };
    } else {
      return state;
    }
  } else if (action.type === "PushScreen") {
    if (state.screenStack.length > 0) {
      const screen = action.screen;
      if (state.screenStack[state.screenStack.length - 1] !== screen) {
        return { ...state, screenStack: Screen.push(state.screenStack, screen) };
      }
    }
    return state;
  } else if (action.type === "PullScreen") {
    return { ...state, screenStack: Screen.pull(state.screenStack) };
  } else if (action.type === "Login") {
    return {
      ...state,
      user: { email: action.email, id: action.userId },
      storage: { ...state.storage, email: action.email },
    };
  } else if (action.type === "Logout") {
    return { ...state, user: undefined, storage: { ...state.storage, email: undefined } };
  } else if (action.type === "StopTimer") {
    const progress = Progress.getProgress(state);
    if (progress != null) {
      return Progress.setProgress(state, Progress.stopTimer(progress));
    } else {
      return state;
    }
  } else if (action.type === "StartTimer") {
    const progress = Progress.getProgress(state);
    const program = progress ? Program.getProgram(state, progress.programId) : undefined;
    if (progress && program) {
      return Progress.setProgress(
        state,
        Progress.startTimer(
          progress,
          program,
          action.timestamp,
          action.mode,
          action.entryIndex,
          action.setIndex,
          state.storage.subscription,
          state.storage.settings,
          action.timer
        )
      );
    } else {
      return state;
    }
  } else if (action.type === "UpdateSettings") {
    return {
      ...state,
      storage: {
        ...state.storage,
        settings: action.lensRecording.fn(state.storage.settings),
      },
    };
  } else if (action.type === "ReplaceState") {
    return action.state;
  } else if (action.type === "UpdateState") {
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
  } else if (action.type === "SyncStorage") {
    const oldStorage = state.storage;
    const newStorage = action.storage;
    if (newStorage?.id != null && oldStorage?.id != null && newStorage.id > oldStorage.id) {
      const storage: IStorage = {
        id: newStorage.id,
        email: newStorage.email,
        reviewRequests: newStorage.reviewRequests,
        signupRequests: newStorage.signupRequests,
        affiliates: newStorage.affiliates,
        stats: {
          weight: {
            weight: CollectionUtils.concatBy(
              oldStorage.stats.weight.weight || [],
              newStorage.stats.weight.weight || [],
              (el) => `${el.timestamp}`
            ),
          },
          length: {
            neck: CollectionUtils.concatBy(
              oldStorage.stats.length.neck || [],
              newStorage.stats.length.neck || [],
              (el) => `${el.timestamp}`
            ),
            shoulders: CollectionUtils.concatBy(
              oldStorage.stats.length.shoulders || [],
              newStorage.stats.length.shoulders || [],
              (el) => `${el.timestamp}`
            ),
            bicepLeft: CollectionUtils.concatBy(
              oldStorage.stats.length.bicepLeft || [],
              newStorage.stats.length.bicepLeft || [],
              (el) => `${el.timestamp}`
            ),
            bicepRight: CollectionUtils.concatBy(
              oldStorage.stats.length.bicepRight || [],
              newStorage.stats.length.bicepRight || [],
              (el) => `${el.timestamp}`
            ),
            forearmLeft: CollectionUtils.concatBy(
              oldStorage.stats.length.forearmLeft || [],
              newStorage.stats.length.forearmLeft || [],
              (el) => `${el.timestamp}`
            ),
            forearmRight: CollectionUtils.concatBy(
              oldStorage.stats.length.forearmRight || [],
              newStorage.stats.length.forearmRight || [],
              (el) => `${el.timestamp}`
            ),
            chest: CollectionUtils.concatBy(
              oldStorage.stats.length.chest || [],
              newStorage.stats.length.chest || [],
              (el) => `${el.timestamp}`
            ),
            waist: CollectionUtils.concatBy(
              oldStorage.stats.length.waist || [],
              newStorage.stats.length.waist || [],
              (el) => `${el.timestamp}`
            ),
            hips: CollectionUtils.concatBy(
              oldStorage.stats.length.hips || [],
              newStorage.stats.length.hips || [],
              (el) => `${el.timestamp}`
            ),
            thighLeft: CollectionUtils.concatBy(
              oldStorage.stats.length.thighLeft || [],
              newStorage.stats.length.thighLeft || [],
              (el) => `${el.timestamp}`
            ),
            thighRight: CollectionUtils.concatBy(
              oldStorage.stats.length.thighRight || [],
              newStorage.stats.length.thighRight || [],
              (el) => `${el.timestamp}`
            ),
            calfLeft: CollectionUtils.concatBy(
              oldStorage.stats.length.calfLeft || [],
              newStorage.stats.length.calfLeft || [],
              (el) => `${el.timestamp}`
            ),
            calfRight: CollectionUtils.concatBy(
              oldStorage.stats.length.calfRight || [],
              newStorage.stats.length.calfRight || [],
              (el) => `${el.timestamp}`
            ),
          },
          percentage: {
            bodyfat: CollectionUtils.concatBy(
              oldStorage.stats.percentage.bodyfat || [],
              newStorage.stats.percentage.bodyfat || [],
              (el) => `${el.timestamp}`
            ),
          },
        },
        settings: {
          equipment: Equipment.mergeEquipment(oldStorage.settings.equipment, newStorage.settings.equipment),
          graphsSettings: newStorage.settings.graphsSettings,
          graphOptions: newStorage.settings.graphOptions,
          exerciseStatsSettings: newStorage.settings.exerciseStatsSettings,
          lengthUnits: newStorage.settings.lengthUnits,
          statsEnabled: newStorage.settings.statsEnabled,
          exercises: newStorage.settings.exercises,
          graphs: newStorage.settings.graphs || [],
          timers: deepmerge(oldStorage.settings.timers, newStorage.settings.timers),
          units: newStorage.settings.units,
          isPublicProfile: newStorage.settings.isPublicProfile,
          shouldShowFriendsHistory: newStorage.settings.shouldShowFriendsHistory,
          nickname: newStorage.settings.nickname,
          volume: newStorage.settings.volume,
        },
        subscription: {
          apple: { ...oldStorage.subscription.apple, ...newStorage.subscription.apple },
          google: { ...oldStorage.subscription.google, ...newStorage.subscription.google },
        },
        tempUserId: newStorage.tempUserId || UidFactory.generateUid(10),
        currentProgramId: newStorage.currentProgramId,
        history: CollectionUtils.concatBy(oldStorage.history, newStorage.history, (el) => el.date!),
        version: newStorage.version,
        programs: newStorage.programs,
        helps: newStorage.helps,
        whatsNew: newStorage.whatsNew,
      };
      return { ...state, storage };
    } else {
      return state;
    }
  } else if (action.type === "CreateProgramAction") {
    const newProgram: IProgram = {
      id: action.name,
      name: action.name,
      url: "",
      author: "",
      shortDescription: "",
      description: "",
      nextDay: 1,
      weeks: [],
      isMultiweek: false,
      days: [{ id: UidFactory.generateUid(8), name: "Day 1", exercises: [] }],
      exercises: [],
      tags: [],
    };
    let newState = lf(state)
      .p("storage")
      .p("programs")
      .modify((programs) => [...programs, newProgram]);
    newState = lf(newState).p("editProgram").set({ id: action.name });
    newState = lf(newState).p("storage").p("currentProgramId").set(newProgram.id);
    return lf(newState).p("screenStack").set(Screen.push(state.screenStack, "editProgram"));
  } else if (action.type === "CreateDayAction") {
    const program = Program.getEditingProgram(state)!;
    const programIndex = Program.getEditingProgramIndex(state)!;
    const days = program.days;
    const dayName = `Day ${days.length + 1}`;
    const day = Program.createDay(dayName);
    let newProgram = lf(program)
      .p("days")
      .modify((d) => [...d, day]);
    if (action.weekIndex != null && newProgram.weeks[action.weekIndex] != null) {
      newProgram = lf(newProgram)
        .p("weeks")
        .i(action.weekIndex)
        .p("days")
        .modify((d) => [...d, { id: day.id }]);
    }

    let newState = lf(state).p("storage").p("programs").i(programIndex).set(newProgram);
    newState = lf(newState)
      .pi("editProgram")
      .p("dayIndex")
      .set(newProgram.days.length - 1);
    return lf(newState).p("screenStack").set(Screen.push(state.screenStack, "editProgramDay"));
  } else if (action.type === "EditDayAction") {
    return {
      ...state,
      editProgram: {
        ...state.editProgram!,
        dayIndex: action.index,
      },
      screenStack: Screen.push(state.screenStack, "editProgramDay"),
    };
  } else if (action.type === "ApplyProgramChangesToProgress") {
    const progress = state.progress[0];
    if (progress != null) {
      const program = Program.getProgram(state, progress.programId)!;
      const programDay = Program.getProgramDay(program, progress.day);
      const newProgress = Progress.applyProgramDay(
        progress,
        program,
        programDay,
        state.storage.settings,
        undefined,
        action.programExerciseIds,
        action.checkReused
      );
      return {
        ...state,
        progress: { ...state.progress, 0: newProgress },
      };
    } else {
      return state;
    }
  } else {
    return state;
  }
};
