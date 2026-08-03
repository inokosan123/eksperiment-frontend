export type DeferredPlanApplication = {
  mode: 'template' | 'today' | 'today-and-template';
  day: number;
  planId: string | null;
};

type PlanApplicationActions = {
  assignToday: (planId: string | null) => void;
  assignTodayAndTemplate: (day: number, planId: string | null) => void;
  assignTemplate: (day: number, planId: string | null) => void;
};

type FrameScheduler = (commit: () => void) => void;

const scheduleNextFrame: FrameScheduler = commit => {
  requestAnimationFrame(commit);
};

export function deferPlanApplicationUntilNextFrame(
  application: DeferredPlanApplication,
  actions: PlanApplicationActions,
  schedule: FrameScheduler = scheduleNextFrame,
) {
  schedule(() => {
    if (application.mode === 'today') {
      actions.assignToday(application.planId);
    } else if (application.mode === 'today-and-template') {
      actions.assignTodayAndTemplate(application.day, application.planId);
    } else {
      actions.assignTemplate(application.day, application.planId);
    }
  });
}
