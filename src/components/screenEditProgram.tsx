import { h, JSX } from "preact";
import { IDispatch } from "../ducks/types";
import { EditProgramDay } from "./editProgram/editProgramDay";
import { EditProgramDaysList } from "./editProgram/editProgramDaysList";
import { Screen, IScreen } from "../models/screen";
import { EditProgramExercise } from "./editProgram/editProgramExercise";
import { IProgram, IProgramExercise, ISettings, ISubscription } from "../types";
import { ILoading } from "../models/state";
import { EditProgramWeek } from "./editProgram/editProgramWeek";

interface IProps {
  editProgram: IProgram;
  editExercise?: IProgramExercise;
  screenStack: IScreen[];
  dispatch: IDispatch;
  programIndex: number;
  subscription: ISubscription;
  dayIndex: number;
  weekIndex?: number;
  settings: ISettings;
  adminKey?: string;
  loading: ILoading;
}

export function ScreenEditProgram(props: IProps): JSX.Element {
  const screen = Screen.current(props.screenStack);
  if (screen === "editProgram") {
    return (
      <EditProgramDaysList
        settings={props.settings}
        screenStack={props.screenStack}
        loading={props.loading}
        dispatch={props.dispatch}
        programIndex={props.programIndex}
        editProgram={props.editProgram}
        adminKey={props.adminKey}
      />
    );
  } else if (screen === "editProgramDay") {
    if (props.dayIndex !== -1) {
      return (
        <EditProgramDay
          loading={props.loading}
          screenStack={props.screenStack}
          settings={props.settings}
          dayIndex={props.dayIndex}
          isProgress={false}
          dispatch={props.dispatch}
          editDay={props.editProgram.days[props.dayIndex]}
          editProgram={props.editProgram}
        />
      );
    } else {
      throw new Error("Opened 'editProgramDay' screen, but 'state.editProgram.editDay' is null");
    }
  } else if (screen === "editProgramWeek") {
    if (props.weekIndex != null && props.weekIndex !== -1) {
      return (
        <EditProgramWeek
          loading={props.loading}
          screenStack={props.screenStack}
          settings={props.settings}
          dispatch={props.dispatch}
          editProgram={props.editProgram}
          editWeek={props.editProgram.weeks[props.weekIndex]}
          weekIndex={props.weekIndex}
        />
      );
    } else {
      throw new Error(`Opened 'editProgramWeek' screen, but 'state.editProgram.weekIndex' is ${props.weekIndex}`);
    }
  } else if (screen === "editProgramExercise") {
    const editExercise = props.editExercise;
    if (editExercise == null) {
      throw new Error("Opened 'editProgramExercise' screen, but 'state.editExercise' is null");
    }
    return (
      <EditProgramExercise
        screenStack={props.screenStack}
        subscription={props.subscription}
        loading={props.loading}
        programIndex={props.programIndex}
        settings={props.settings}
        program={props.editProgram}
        dispatch={props.dispatch}
        programExercise={editExercise}
      />
    );
  } else {
    throw new Error(`Unknown screen ${screen}`);
  }
}
