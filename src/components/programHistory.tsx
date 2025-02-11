import { h, JSX } from "preact";
import { IDispatch } from "../ducks/types";
import { Program } from "../models/program";
import { Thunk } from "../ducks/thunks";
import { useState } from "preact/hooks";
import { IProgram, IHistoryRecord, ISettings, IStats } from "../types";
import { HistoryRecordsList } from "./historyRecordsList";
import { IAllComments, IAllLikes, IFriendUser, ILoading } from "../models/state";
import { Surface } from "./surface";
import { NavbarView } from "./navbar";
import { IScreen, Screen } from "../models/screen";
import { Footer2View } from "./footer2";
import { IconDoc } from "./icons/iconDoc";
import { HelpProgramHistory } from "./help/helpProgramHistory";
import { BottomSheet } from "./bottomSheet";
import { BottomSheetItem } from "./bottomSheetItem";
import { IconEditSquare } from "./icons/iconEditSquare";
import { useGradualList } from "../utils/useGradualList";
import { IconUser } from "./icons/iconUser";
import { ObjectUtils } from "../utils/object";

interface IProps {
  program: IProgram;
  progress?: IHistoryRecord;
  editProgramId?: string;
  history: IHistoryRecord[];
  screenStack: IScreen[];
  friendsHistory: Partial<Record<string, IFriendUser>>;
  stats: IStats;
  comments: IAllComments;
  likes: IAllLikes;
  userId?: string;
  settings: ISettings;
  loading: ILoading;
  dispatch: IDispatch;
}

export function ProgramHistoryView(props: IProps): JSX.Element {
  const dispatch = props.dispatch;
  const sortedHistory = props.history.sort((a, b) => {
    return new Date(Date.parse(b.date)).getTime() - new Date(Date.parse(a.date)).getTime();
  });
  const nextHistoryRecord = props.progress || Program.nextProgramRecord(props.program, props.settings);
  const history = [nextHistoryRecord, ...sortedHistory];
  const [containerRef, visibleRecords] = useGradualList(history, 20, (vr, nextVr) => {
    const enddate = sortedHistory[vr - 1]?.date;
    const startdate = sortedHistory[nextVr - 1]?.date;
    dispatch(Thunk.fetchFriendsHistory(startdate || "2019-01-01T00:00:00.000Z", enddate));
    dispatch(Thunk.fetchLikes(startdate || "2019-01-01T00:00:00.000Z", enddate));
    dispatch(Thunk.getComments(startdate || "2019-01-01T00:00:00.000Z", enddate));
  });

  const [showProgramBottomSheet, setShowProgramBottomSheet] = useState(false);
  const isUserLoading = ObjectUtils.values(props.loading.items).some((i) => i?.type === "fetchStorage" && !i.endTime);

  return (
    <Surface
      ref={containerRef}
      navbar={
        <NavbarView
          rightButtons={[
            <button
              data-cy="navbar-user"
              className="p-2 nm-navbar-user"
              onClick={() => props.dispatch(Thunk.pushScreen("account"))}
            >
              <IconUser size={22} color={props.userId ? "#38A169" : isUserLoading ? "#607284" : "#E53E3E"} />
            </button>,
          ]}
          loading={props.loading}
          dispatch={dispatch}
          helpContent={<HelpProgramHistory />}
          screenStack={props.screenStack}
          title="Workout History"
        />
      }
      footer={<Footer2View dispatch={props.dispatch} screen={Screen.current(props.screenStack)} />}
      addons={
        <BottomSheet isHidden={!showProgramBottomSheet} onClose={() => setShowProgramBottomSheet(false)}>
          <div className="p-4">
            <BottomSheetItem
              name="choose-program"
              title="Choose Another Program"
              isFirst={true}
              icon={<IconDoc />}
              description="Select a program for the next workout."
              onClick={() => dispatch(Thunk.pushScreen("programs"))}
            />
            <BottomSheetItem
              name="edit-program"
              title="Edit Current Program"
              icon={<IconEditSquare />}
              description={`Edit the current program '${props.program.name}'.`}
              onClick={() => {
                if (props.editProgramId == null || props.editProgramId !== props.program.id) {
                  Program.editAction(props.dispatch, props.program.id);
                } else {
                  alert("You cannot edit the program while that program's workout is in progress");
                }
              }}
            />
          </div>
        </BottomSheet>
      }
    >
      <HistoryRecordsList
        comments={props.comments}
        history={history}
        settings={props.settings}
        dispatch={dispatch}
        likes={props.likes}
        visibleRecords={visibleRecords}
        currentUserId={props.userId}
        friendsHistory={props.friendsHistory}
      />
    </Surface>
  );
}
