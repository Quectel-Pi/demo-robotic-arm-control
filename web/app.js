import { initializeLocalization } from "./i18n.js?v=single-client-ip-1";
import * as THREE from "./vendor/three.module.js";
import { OrbitControls } from "./vendor/OrbitControls.js";

const localization = initializeLocalization();

const MOD1_POSITION_SCALE = 1000 / 270;
const DEFAULT_JOINTS = [
  { id: 0, name: "Joint 1", key: "j1", min_pos: 120, max_pos: 880, direction: 1, position_scale: 1000 / 360 },
  { id: 1, name: "Joint 2", key: "j2", min_pos: 140, max_pos: 860, direction: -1 },
  { id: 2, name: "Joint 3", key: "j3", min_pos: 120, max_pos: 880, direction: 1 },
  { id: 3, name: "Joint 4", key: "j4", min_pos: 110, max_pos: 890, direction: 1 },
  { id: 4, name: "Joint 5", key: "j5", min_pos: 130, max_pos: 870, direction: -1 },
  { id: 5, name: "Joint 6", key: "j6", min_pos: 160, max_pos: 840, direction: 1 },
].map((joint) => {
  const positionScale = joint.position_scale ?? MOD1_POSITION_SCALE;
  const maximumPosition = joint.id === 5 ? Math.min(joint.max_pos, 600) : joint.max_pos;
  const bounds = [joint.min_pos, maximumPosition].map((position) => (position - 500) / positionScale * joint.direction);
  return { ...joint, center_pos: 500, center_deg: 0, position_scale: positionScale,
    min_deg: Math.min(...bounds), max_deg: Math.max(...bounds) };
});

const PWM_PER_POSITION = 2;
const PWM_POSITION_OFFSET = 500;
const CATALOG_ACTION_LABELS_EN = Object.freeze({
  offset_adjustment: "Offset adjustment",
  curl_pose: "Curled pose",
  grasp_pose: "Grasp pose",
  front_grab: "Front pick",
  left_grab: "Left pick",
  right_grab: "Right pick",
  front_place: "Front place",
  left_place: "Left place",
  right_place: "Right place",
  combined_sequence: "Combined sequence",
});
const DEFAULT_CATALOG_DEMO_SEQUENCE = Object.freeze([
  { start: 0, end: 0 },
  { start: 1, end: 1 },
  { start: 3, end: 7 },
  { start: 27, end: 31 },
  { start: 13, end: 17 },
  { start: 18, end: 21 },
]);
const CATALOG_DEMO_SEQUENCE_STORAGE_KEY = "jibot-demo-sequence-v1";

function loadCatalogDemoSequence() {
  try {
    const saved = window.localStorage.getItem(CATALOG_DEMO_SEQUENCE_STORAGE_KEY);
    if (saved === null) return DEFAULT_CATALOG_DEMO_SEQUENCE.map((step) => ({ ...step }));
    const parsed = JSON.parse(saved);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((step) => step && step.start !== undefined && step.end !== undefined)
      .map((step) => ({ start: Number(step.start), end: Number(step.end) }))
      .filter((step) => Number.isInteger(step.start) && Number.isInteger(step.end)
        && step.start >= 0 && step.end >= step.start)
      .slice(0, 40);
  } catch {
    return DEFAULT_CATALOG_DEMO_SEQUENCE.map((step) => ({ ...step }));
  }
}

function saveCatalogDemoSequence() {
  try {
    window.localStorage.setItem(CATALOG_DEMO_SEQUENCE_STORAGE_KEY, JSON.stringify(catalogDemoSequence));
  } catch {
    // Keep the sequence available for this page session when storage is disabled.
  }
}

function getCatalogActionLabel(action) {
  if (CATALOG_ACTION_LABELS_EN[action.key]) return CATALOG_ACTION_LABELS_EN[action.key];
  const sourceLabel = String(action.label || "").trim();
  if (/^[\x20-\x7e]*$/.test(sourceLabel)) return sourceLabel || "Action group";
  const fallbackKey = String(action.key || "").replace(/[^a-z\d]+/gi, " ").trim();
  return fallbackKey ? fallbackKey.replace(/\b\w/g, (letter) => letter.toUpperCase()) : "Action group";
}

function angleToPwm(joint, angleDeg) {
  const positionsPerDegree = joint.position_scale ?? MOD1_POSITION_SCALE;
  const rawPosition = (joint.center_pos ?? 500) + (angleDeg - (joint.center_deg ?? 0)) * positionsPerDegree * joint.direction;
  const position = Math.max(joint.min_pos, Math.min(joint.max_pos, Math.round(rawPosition)));
  return PWM_POSITION_OFFSET + PWM_PER_POSITION * position;
}

const elements = {
  connectionPill: document.getElementById("connection-pill"),
  connectionLabel: document.getElementById("connection-label"),
  backendLabel: document.getElementById("backend-label"),
  connectButton: document.getElementById("connect-button"),
  stopButton: document.getElementById("stop-button"),
  refreshButton: document.getElementById("refresh-button"),
  onlineCount: document.getElementById("online-count"),
  motionState: document.getElementById("motion-state"),
  modeTag: document.getElementById("mode-tag"),
  lastUpdate: document.getElementById("last-update"),
  footerMessage: document.getElementById("footer-message"),
  jointList: document.getElementById("joint-list"),
  manualToggle: document.getElementById("manual-toggle"),
  manualPanel: document.getElementById("manual-panel"),
  manualClose: document.getElementById("manual-close"),
  manualHint: document.getElementById("manual-hint"),
  jointHeading: document.getElementById("joint-heading"),
  calibrationPanel: document.getElementById("calibration-panel"),
  calibrationToggle: document.getElementById("calibration-toggle"),
  modelLoading: document.getElementById("model-loading"),
  modelLoaderRing: document.querySelector(".loader-ring"),
  modelLoadingTitle: document.getElementById("model-loading-title"),
  modelLoadingDetail: document.getElementById("model-loading-detail"),
  modelState: document.getElementById("model-state"),
  modelSourceChip: document.getElementById("model-source-chip"),
  modelModeLabel: document.getElementById("model-mode-label"),
  modelHeadingSubtitle: document.querySelector(".heading-muted"),
  modelSummary: document.querySelector(".model-summary"),
  modelNote: document.getElementById("model-note"),
  selectedPart: document.getElementById("selected-part"),
  toast: document.getElementById("toast"),
  resetCamera: document.getElementById("reset-camera"),
  canvasHost: document.getElementById("canvas-host"),
  actionName: document.getElementById("action-name"),
  actionCount: document.getElementById("action-count"),
  actionHint: document.getElementById("action-hint"),
  recordStart: document.getElementById("record-start"),
  recordingPanel: document.getElementById("recording-panel"),
  recordingStatus: document.getElementById("recording-status"),
  poseDuration: document.getElementById("pose-duration"),
  capturePose: document.getElementById("capture-pose"),
  recordedPoseList: document.getElementById("recorded-pose-list"),
  recordCancel: document.getElementById("record-cancel"),
  recordSave: document.getElementById("record-save"),
  actionGroupList: document.getElementById("action-group-list"),
  catalogActionCount: document.getElementById("catalog-action-count"),
  catalogStartGroup: document.getElementById("catalog-start-group"),
  catalogEndGroup: document.getElementById("catalog-end-group"),
  catalogRepeatCount: document.getElementById("catalog-repeat-count"),
  catalogPlaybackTarget: document.getElementById("catalog-playback-target"),
  catalogRunMode: document.getElementById("catalog-run-mode"),
  catalogRun: document.getElementById("catalog-run"),
  catalogSequenceList: document.getElementById("catalog-sequence-list"),
  catalogSequenceCount: document.getElementById("catalog-sequence-count"),
  catalogSequenceAdd: document.getElementById("catalog-sequence-add"),
  catalogSequenceClear: document.getElementById("catalog-sequence-clear"),
  catalogOnlineNote: document.getElementById("catalog-online-note"),
  catalogActionRows: document.getElementById("catalog-action-rows"),
  catalogRunStatus: document.getElementById("catalog-run-status"),
  catalogRefresh: document.getElementById("catalog-refresh"),
  baselineChip: document.getElementById("baseline-chip"),
  axisReference: document.getElementById("axis-reference"),
  checkCount: document.getElementById("axis-check-count"),
  checkJoint: document.getElementById("check-joint"),
  checkStep: document.getElementById("check-step"),
  checkReadout: document.getElementById("check-readout"),
  checkPositive: document.getElementById("check-positive"),
  checkNegative: document.getElementById("check-negative"),
  checkMinus: document.getElementById("check-minus"),
  checkZero: document.getElementById("check-zero"),
  checkPlus: document.getElementById("check-plus"),
  checkStatus: document.getElementById("check-status"),
  checkMatch: document.getElementById("check-match"),
  checkMismatch: document.getElementById("check-mismatch"),
};

const jointState = new Map(DEFAULT_JOINTS.map((joint) => [joint.id, {
  ...joint,
  position: null,
  angle_deg: 0,
  pwm: 1500,
  online: false,
  target_deg: 0,
}]));

let apiConnected = false;
let controllerBackend = null;
let offlinePreviewPoseHeld = false;
let commandBusy = false;
let controllerBusy = false;
let pollTimer = null;
let toastTimer = null;
let actionGroups = [];
let recordingDraft = null;
let sequenceStopRequested = false;
let catalogActionLibrary = null;
let catalogDemoSequence = loadCatalogDemoSequence();
let selectedJointId = null;
let manualControlMode = "closed";
let catalogPlaybackBusy = false;
let catalogPreviewStopRequested = false;
let activeCatalogRunMode = null;
let calibration = null;
let axisChecks = {};
let axisCheckSample = null;
let modelDisplayMode = "unavailable";
let modelUnavailableMessage = "";
let modelLoadRevision = 0;
let activeStepWorker = null;

const STEP_UNAVAILABLE_TITLE = "Jibot1 STEP model not found";
const STEP_UNAVAILABLE_MESSAGE = "Place a compatible Jibot1 STEP file at web/models/jibot1.step, then reload the page.";
const STEP_PARSE_FAILED_TITLE = "Jibot1 STEP model could not be loaded";
const STEP_PARSE_FAILED_MESSAGE = "Check that web/models/jibot1.step is a compatible Jibot1 assembly.";

function updateReference(reference) {
  if (!reference) return;
  if (calibration?.reference_id !== reference.reference_id) {
    axisCheckSample = null;
    try { axisChecks = JSON.parse(localStorage.getItem(`jibot-axis-check:${reference.reference_id}`) || "{}"); }
    catch { axisChecks = {}; }
    if (!axisChecks || typeof axisChecks !== "object" || Array.isArray(axisChecks)) axisChecks = {};
  }
  calibration = reference;
  elements.baselineChip.textContent = reference.active ? "ZERO · SAVED BASELINE" : "ZERO · NOMINAL REFERENCE";
  elements.axisReference.textContent = reference.active
    ? "Baseline saved · angles are relative to the confirmed pose."
    : "Confirm and save a physical baseline before checking axes.";
  updateModelNote();
}

function updateModelNote() {
  const referenceNote = calibration?.active
    ? "Saved reference: " + calibration.joints.map((j) => `J${j.id + 1} ${j.pwm} µs`).join(" · ")
    : "Nominal reference: all six servos at 1500 µs (0°).";
  const geometryNote = modelUnavailableMessage || (modelDisplayMode === "step"
    ? "Jibot1 STEP assembly loaded from web/models/jibot1.step."
    : modelDisplayMode === "loading"
      ? "Loading Jibot1 STEP model from web/models/jibot1.step."
      : "The 3D view requires a Jibot1 STEP file at web/models/jibot1.step.");
  elements.modelNote.textContent = `${referenceNote} ${geometryNote}`;
}

function axisCheckObservation() {
  const id = Number(elements.checkJoint.value);
  const joint = jointState.get(id);
  if (!calibration?.active || !apiConnected || !joint?.online || !Number.isFinite(joint.angle_deg)
    || Math.abs(joint.angle_deg) < 1 || joint.status === "error" || commandBusy || controllerBusy
    || catalogPlaybackBusy || recordingDraft || !elements.modelSummary.classList.contains("is-loaded")) return null;
  const sample = axisCheckSample?.id === id && axisCheckSample.success
    && Math.abs(joint.angle_deg - axisCheckSample.readback) < 1 ? axisCheckSample : null;
  return {
    id, target: sample?.target ?? joint.angle_deg,
    targetPwm: sample?.targetPwm ?? joint.pwm,
    readback: joint.angle_deg, pwm: joint.pwm,
    direction: joint.angle_deg > 0 ? "positive" : "negative",
    basis: sample ? "axis_move" : "live_pose",
  };
}

function updateAxisCheck() {
  const id = Number(elements.checkJoint.value);
  const joint = jointState.get(id);
  const step = Number(elements.checkStep.value);
  const ready = Boolean(calibration?.active && apiConnected && allJointsOnline()
    && !commandBusy && !controllerBusy && !catalogPlaybackBusy && !recordingDraft
    && elements.modelSummary.classList.contains("is-loaded"));
  elements.checkJoint.disabled = commandBusy || controllerBusy || catalogPlaybackBusy;
  elements.checkStep.disabled = elements.checkJoint.disabled;
  elements.checkMinus.textContent = `−${step}°`;
  elements.checkPlus.textContent = `+${step}°`;
  elements.checkMinus.title = `Move only J${id + 1} to −${step}° from the saved reference`;
  elements.checkPlus.title = `Move only J${id + 1} to +${step}° from the saved reference`;
  elements.checkMinus.disabled = !ready || -step < joint.min_deg;
  elements.checkPlus.disabled = !ready || step > joint.max_deg;
  elements.checkZero.disabled = !ready;
  const referencePwm = calibration?.joints?.find((j) => j.id === id)?.pwm;
  const readback = joint.online && Number.isFinite(joint.angle_deg)
    ? `${joint.angle_deg.toFixed(1)}° / ${joint.pwm} µs` : "OFFLINE";
  const sample = axisCheckSample?.id === id ? axisCheckSample : null;
  elements.checkReadout.textContent = `Zero ${referencePwm ?? "—"} µs · Readback ${readback}`
    + (sample ? `\nTarget ${sample.target.toFixed(1)}° / ${sample.targetPwm} µs` : "");
  const observation = axisCheckObservation();
  elements.checkMatch.disabled = !observation;
  elements.checkMismatch.disabled = !observation;
  const checks = axisChecks[id] || {};
  const label = (value) => value === "match" ? "✓ Matches 3D" : value === "mismatch" ? "Needs adjustment" : "Pending";
  for (const [direction, badge] of [["positive", elements.checkPositive], ["negative", elements.checkNegative]]) {
    const result = checks[direction]?.result;
    badge.textContent = `${direction === "positive" ? "+" : "−"} ${label(result)}`;
    badge.dataset.state = result || "pending";
  }
  const previous = observation ? checks[observation.direction] : null;
  const samePose = previous && Math.abs((previous.readback ?? previous.target) - observation.readback) < 1;
  const savedResult = samePose ? previous.result : null;
  elements.checkMatch.textContent = savedResult === "match" ? "✓ Matches 3D" : "Matches 3D";
  elements.checkMismatch.textContent = savedResult === "mismatch" ? "✓ Needs adjustment" : "Needs adjustment";
  elements.checkMatch.classList.toggle("is-recorded", savedResult === "match");
  elements.checkMismatch.classList.toggle("is-recorded", savedResult === "mismatch");
  elements.checkStatus.dataset.state = savedResult || "pending";
  if (observation) {
    const poseLabel = `J${id + 1} ${observation.readback > 0 ? "+" : ""}${observation.readback.toFixed(1)}°`;
    elements.checkStatus.textContent = savedResult
      ? `${poseLabel}: ${label(savedResult)}. ${previous.session_only ? "Recorded for this session." : "Saved in this browser."}`
      : `Compare J${id + 1} at ${observation.readback.toFixed(1)}° with the real arm, then mark the result.`;
  } else {
    elements.checkStatus.textContent = !calibration?.active ? "Save a baseline before checking axes."
      : !apiConnected ? "Reconnect the controller to read the current pose."
      : commandBusy || controllerBusy || catalogPlaybackBusy ? "Wait for motion or preview to finish before marking a result."
      : recordingDraft ? "Finish recording before checking an axis."
      : !elements.modelSummary.classList.contains("is-loaded") ? "Wait for the 3D model to load."
      : !joint.online || !Number.isFinite(joint.angle_deg) || joint.status === "error"
        ? `J${id + 1} position feedback is unavailable. Refresh state, then compare the live pose.`
        : `J${id + 1} is near zero. Move to +${step}° or −${step}° before marking a direction.`;
  }
  elements.checkMatch.title = observation ? "Record your comparison of the current live pose" : elements.checkStatus.textContent;
  elements.checkMismatch.title = elements.checkMatch.title;
  const checked = Object.values(axisChecks).filter((check) => check.positive?.result === "match" && check.negative?.result === "match").length;
  elements.checkCount.textContent = `${checked} / 6 CHECKED`;
}

async function moveCheckAxis(target) {
  if (commandBusy || controllerBusy || catalogPlaybackBusy || recordingDraft || !apiConnected || !calibration?.active) return;
  const id = Number(elements.checkJoint.value);
  selectJointControl(id, true);
  const card = elements.jointList.querySelector(`[data-joint-id="${id}"]`);
  axisCheckSample = null;
  const result = await moveJoint(id, target, card);
  if (result?.status === "complete" && result.servo?.online) {
    axisCheckSample = {
      id, target, targetPwm: angleToPwm(jointState.get(id), target),
      readback: result.servo.angle_deg, success: true,
    };
  }
  updateAxisCheck();
}

function markAxisCheck(result) {
  const observation = axisCheckObservation();
  if (!observation) {
    updateAxisCheck();
    showToast(elements.checkStatus.textContent, "error");
    return;
  }
  const { id, direction } = observation;
  const check = { ...observation, result, checked_at: new Date().toISOString() };
  axisChecks[id] = { ...axisChecks[id], [direction]: check };
  let saved = true;
  try { localStorage.setItem(`jibot-axis-check:${calibration.reference_id}`, JSON.stringify(axisChecks)); }
  catch { saved = false; check.session_only = true; }
  updateAxisCheck();
  const pose = `J${id + 1} ${observation.readback > 0 ? "+" : ""}${observation.readback.toFixed(1)}°`;
  const verdict = result === "match" ? "Matches 3D" : "Needs adjustment";
  showToast(`${pose} · ${verdict} · ${saved ? "Saved" : "Recorded for this session; browser storage is unavailable"}`,
    saved && result === "match" ? "success" : "info");
}

function showToast(message, kind = "info") {
  elements.toast.textContent = message;
  elements.toast.dataset.kind = kind;
  elements.toast.classList.add("is-visible");
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => elements.toast.classList.remove("is-visible"), 3300);
}

function setConnection(state, message) {
  elements.connectionPill.dataset.state = state;
  elements.connectionLabel.textContent = message;
  elements.modeTag.dataset.state = state;
  elements.modeTag.textContent = state === "online"
    ? controllerBackend === "mock" ? "SIMULATION" : "MANUAL READY"
    : state === "error" ? "CHECK LINK" : "WAITING";
}

function requestHeaders(extra = {}) {
  return { ...extra };
}

async function apiRequest(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: requestHeaders({ "Content-Type": "application/json", ...(options.headers || {}) }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = payload.detail || payload.message || `Controller returned ${response.status}`;
    throw new Error(message);
  }
  return payload;
}

function currentPoseAngles() {
  return DEFAULT_JOINTS.map((joint) => {
    const state = jointState.get(joint.id);
    return state?.online && Number.isFinite(state.angle_deg) ? Number(state.angle_deg) : null;
  });
}

function allJointsOnline() {
  return [...jointState.values()].length === 6 && [...jointState.values()].every((joint) => joint.online);
}

function renderRecordedPoses() {
  elements.recordedPoseList.replaceChildren();
  if (!recordingDraft) return;
  elements.recordingStatus.textContent = `RECORDING · ${recordingDraft.frames.length} POSES`;
  recordingDraft.frames.forEach((frame, index) => {
    const item = document.createElement("li");
    const pose = frame.angles_deg.map((angle) => `${Math.round(angle)}°`).join(" / ");
    item.textContent = `Pose ${index + 1} · ${pose} · ${(frame.duration_ms / 1000).toFixed(1)} s`;
    elements.recordedPoseList.append(item);
  });
}

function updateActionControls() {
  const ready = apiConnected && allJointsOnline() && !commandBusy && !controllerBusy && !catalogPlaybackBusy;
  const recording = recordingDraft !== null;
  elements.actionName.disabled = recording || commandBusy || catalogPlaybackBusy;
  elements.recordStart.disabled = !ready || recording;
  elements.recordingPanel.hidden = !recording;
  elements.capturePose.disabled = !ready || !recording || recordingDraft.frames.length >= 200;
  elements.poseDuration.disabled = commandBusy || catalogPlaybackBusy || !recording;
  elements.recordCancel.disabled = commandBusy || catalogPlaybackBusy || !recording;
  elements.recordSave.disabled = commandBusy || catalogPlaybackBusy || !recording || recordingDraft.frames.length === 0;
  elements.actionHint.textContent = recording
    ? "Move the arm with the joint sliders, then capture each pose."
    : apiConnected
      ? allJointsOnline()
        ? "Start a recording, move joints, and capture each pose to build a sequence."
        : "All six joints must be online before recording or playback."
      : "Connect all six joints to record or play action groups.";
  elements.actionCount.textContent = `${actionGroups.length} SAVED`;
  for (const button of elements.actionGroupList.querySelectorAll("button")) {
    button.disabled = !ready || recording;
  }
  elements.actionName.disabled = commandBusy || catalogPlaybackBusy || recording;
  updateCatalogControls();
  updateAxisCheck();
}

function renderActionGroups() {
  elements.actionGroupList.replaceChildren();
  if (actionGroups.length === 0) {
    const empty = document.createElement("div");
    empty.className = "action-empty";
    empty.textContent = "No saved action groups yet.";
    elements.actionGroupList.append(empty);
    updateActionControls();
    return;
  }

  for (const group of actionGroups) {
    const card = document.createElement("article");
    card.className = "action-group-card";
    const main = document.createElement("div");
    main.className = "action-group-main";
    const name = document.createElement("div");
    name.className = "action-group-name";
    name.dataset.i18nIgnore = "";
    name.textContent = group.name || "Untitled action";
    const meta = document.createElement("div");
    meta.className = "action-group-meta";
    const poseCount = Array.isArray(group.frames) ? group.frames.length : 0;
    meta.textContent = `${poseCount} ${poseCount === 1 ? "POSE" : "POSES"}`;
    main.append(name, meta);

    const actions = document.createElement("div");
    actions.className = "action-group-actions";
    const playButton = document.createElement("button");
    playButton.className = "button button-primary";
    playButton.type = "button";
    playButton.textContent = "Play";
    playButton.addEventListener("click", () => playActionGroup(group));
    const deleteButton = document.createElement("button");
    deleteButton.className = "action-delete";
    deleteButton.type = "button";
    deleteButton.textContent = "Delete";
    deleteButton.setAttribute("aria-label", `Delete ${group.name || "action group"}`);
    deleteButton.addEventListener("click", () => deleteActionGroup(group));
    actions.append(playButton, deleteButton);
    card.append(main, actions);
    elements.actionGroupList.append(card);
  }
  updateActionControls();
}

async function loadActionGroups() {
  const data = await apiRequest("/api/action-groups");
  actionGroups = Array.isArray(data.groups) ? data.groups : [];
  renderActionGroups();
}

function catalogActionForGroup(groupId) {
  return catalogActionLibrary?.actions?.find((action) =>
    Number(action.start_group) <= groupId && groupId <= Number(action.end_group));
}

function catalogPwmToAngle(servoId, pwm) {
  const joint = jointState.get(Number(servoId));
  if (!joint) return 0;
  const offset = catalogActionLibrary?.calibration?.joints?.find((j) => Number(j.id) === Number(servoId))?.offset_pwm || 0;
  const position = (Number(pwm) + offset - PWM_POSITION_OFFSET) / PWM_PER_POSITION;
  const positionsPerDegree = joint.position_scale ?? MOD1_POSITION_SCALE;
  return (joint.center_deg ?? 0) + ((position - (joint.center_pos ?? 500)) / positionsPerDegree) * joint.direction;
}

function catalogGroupIssues(group) {
  const issues = [];
  const safety = catalogActionLibrary?.safety || {};
  const servoIds = catalogActionLibrary?.servo_ids || [];
  for (const [index, rawPwm] of (group.pwm || []).entries()) {
    const servoId = Number(servoIds[index]);
    const offset = catalogActionLibrary?.calibration?.joints?.find((j) => Number(j.id) === servoId)?.offset_pwm || 0;
    const pwm = Number(rawPwm) + offset;
    const limit = safety.pwm_limits?.[String(servoId)];
    if (limit && (pwm < Number(limit.min_pwm) || pwm > Number(limit.max_pwm))) {
      issues.push(`ID ${servoId} PWM ${pwm} exceeds the configured soft limits`);
    }
    if (servoId === 5 && pwm > Number(safety.gripper_closed_pwm ?? 1700)) {
      issues.push(`J6 PWM ${pwm} exceeds the confirmed gripper close limit`);
    }
  }
  return [...new Set(issues)];
}

function getCatalogGroupsInRange(start, end) {
  if (!catalogActionLibrary) return [];
  start = Number(start);
  end = Number(end);
  if (!Number.isInteger(start) || !Number.isInteger(end) || start > end) return [];
  return catalogActionLibrary.groups.filter((group) => {
    const id = Number(group.id);
    return id >= start && id <= end;
  });
}

function getSelectedCatalogGroups() {
  return getCatalogGroupsInRange(elements.catalogStartGroup.value, elements.catalogEndGroup.value);
}

function getCatalogRangeLabel(start, end) {
  start = Number(start);
  end = Number(end);
  const range = `G${String(start).padStart(4, "0")}`
    + (start === end ? "" : `–G${String(end).padStart(4, "0")}`);
  if (start === 0 && end === 0) return `Calibrated zero · ${range}`;
  const action = catalogActionLibrary?.actions?.find((item) =>
    Number(item.start_group) === start && Number(item.end_group) === end);
  return action ? `${getCatalogActionLabel(action)} · ${range}` : `Groups ${range}`;
}

function renderCatalogDemoSequence() {
  elements.catalogSequenceList.replaceChildren();
  elements.catalogSequenceCount.textContent = `${catalogDemoSequence.length} STEPS`;
  if (!catalogDemoSequence.length) {
    const empty = document.createElement("li");
    empty.className = "catalog-demo-sequence-empty";
    empty.textContent = "No ranges in the demo sequence. Add a selected range below.";
    elements.catalogSequenceList.append(empty);
    return;
  }

  catalogDemoSequence.forEach((step, index) => {
    const item = document.createElement("li");
    item.className = "catalog-demo-sequence-item";
    const number = document.createElement("span");
    number.className = "catalog-demo-sequence-number";
    number.textContent = String(index + 1).padStart(2, "0");
    const label = document.createElement("span");
    label.className = "catalog-demo-sequence-label";
    label.textContent = getCatalogRangeLabel(step.start, step.end)
      + (catalogActionLibrary && !getCatalogGroupsInRange(step.start, step.end).length ? " · Unavailable" : "");

    const buttons = document.createElement("div");
    buttons.className = "catalog-demo-sequence-buttons";
    for (const [action, glyph, title, disabled] of [
      ["up", "↑", "Move step up", index === 0],
      ["down", "↓", "Move step down", index === catalogDemoSequence.length - 1],
      ["remove", "×", "Remove step", false],
    ]) {
      const button = document.createElement("button");
      button.className = "icon-button";
      button.type = "button";
      button.textContent = glyph;
      button.title = `${title}: ${getCatalogRangeLabel(step.start, step.end)}`;
      button.setAttribute("aria-label", button.title);
      button.dataset.sequenceAction = action;
      button.dataset.sequenceIndex = String(index);
      button.disabled = disabled || catalogPlaybackBusy;
      button.addEventListener("click", () => handleCatalogSequenceStepAction(action, index));
      buttons.append(button);
    }
    item.append(number, label, buttons);
    elements.catalogSequenceList.append(item);
  });
}

function handleCatalogSequenceStepAction(action, index) {
  if (catalogPlaybackBusy || !catalogDemoSequence[index]) return;
  if (action === "remove") {
    catalogDemoSequence.splice(index, 1);
  } else {
    const destination = index + (action === "up" ? -1 : 1);
    if (destination < 0 || destination >= catalogDemoSequence.length) return;
    [catalogDemoSequence[index], catalogDemoSequence[destination]] =
      [catalogDemoSequence[destination], catalogDemoSequence[index]];
  }
  saveCatalogDemoSequence();
  renderCatalogDemoSequence();
  updateCatalogControls();
}

function addSelectedRangeToDemoSequence() {
  const groups = getSelectedCatalogGroups();
  const start = Number(elements.catalogStartGroup.value);
  const end = Number(elements.catalogEndGroup.value);
  if (!groups.length || !Number.isInteger(start) || !Number.isInteger(end) || start > end) return;
  if (catalogDemoSequence.length >= 40) {
    showToast("The demo sequence can contain up to 40 ranges.", "info");
    return;
  }
  catalogDemoSequence.push({ start, end });
  saveCatalogDemoSequence();
  renderCatalogDemoSequence();
  updateCatalogControls();
}

function clearCatalogDemoSequence() {
  if (catalogPlaybackBusy || !catalogDemoSequence.length) return;
  catalogDemoSequence = [];
  saveCatalogDemoSequence();
  renderCatalogDemoSequence();
  updateCatalogControls();
}

function getCatalogRunMode() {
  if (catalogPlaybackBusy && activeCatalogRunMode) return activeCatalogRunMode;
  return apiConnected && controllerBackend !== null && controllerBackend !== "mock" && allJointsOnline()
    ? "online"
    : "preview";
}

function updateCatalogControls() {
  const groups = catalogActionLibrary?.groups || [];
  const selectedGroups = getSelectedCatalogGroups();
  const rangeValid = selectedGroups.length > 0;
  const sequenceValid = catalogDemoSequence.length > 0
    && catalogDemoSequence.every((step) => getCatalogGroupsInRange(step.start, step.end).length > 0);
  const sequenceMode = elements.catalogPlaybackTarget.value === "sequence";
  const targetValid = sequenceMode ? sequenceValid : rangeValid;
  const repeatCount = Number(elements.catalogRepeatCount.value);
  const repeatValid = Number.isInteger(repeatCount) && repeatCount >= 1 && repeatCount <= 20;
  const mode = getCatalogRunMode();
  const onlineReady = mode === "online" && !controllerBusy && !commandBusy;
  const previewReady = mode === "preview" && !controllerBusy && !commandBusy && !recordingDraft
    && elements.modelSummary.classList.contains("is-loaded");
  const isPreviewStop = catalogPlaybackBusy && !commandBusy;
  const controlsDisabled = !groups.length || catalogPlaybackBusy;

  elements.catalogRunMode.textContent = mode === "online" ? "AUTO · ONLINE RUN" : "AUTO · OFFLINE PREVIEW";
  elements.catalogOnlineNote.hidden = false;
  elements.catalogOnlineNote.textContent = mode === "online"
    ? "All six servos are online. Online run moves the real arm and requires the controller to be idle."
    : controllerBackend === "mock"
      ? "Simulation backend is active. Offline preview animates only the 3D model and sends no hardware commands."
      : !apiConnected
        ? "Controller state is unavailable. Offline preview animates only the 3D model; online run requires the controller and all six servos."
        : "Fewer than six servos are online. Offline preview animates only the 3D model and sends no hardware commands.";
  elements.catalogStartGroup.disabled = controlsDisabled;
  elements.catalogEndGroup.disabled = controlsDisabled;
  elements.catalogRepeatCount.disabled = controlsDisabled;
  elements.catalogPlaybackTarget.disabled = controlsDisabled;
  for (const button of elements.catalogActionRows.querySelectorAll(".catalog-category-button")) {
    button.disabled = catalogPlaybackBusy;
  }
  for (const button of elements.catalogSequenceList.querySelectorAll("button[data-sequence-action]")) {
    const index = Number(button.dataset.sequenceIndex);
    button.disabled = catalogPlaybackBusy
      || (button.dataset.sequenceAction === "up" && index === 0)
      || (button.dataset.sequenceAction === "down" && index === catalogDemoSequence.length - 1);
  }
  elements.catalogSequenceAdd.disabled = controlsDisabled || !rangeValid || catalogDemoSequence.length >= 40;
  elements.catalogSequenceClear.disabled = catalogPlaybackBusy || !catalogDemoSequence.length;
  elements.catalogRun.disabled = isPreviewStop
    ? false
    : catalogPlaybackBusy || !targetValid || !repeatValid || (mode === "online" ? !onlineReady : !previewReady);
  elements.catalogRun.textContent = isPreviewStop
    ? "Stop preview"
    : catalogPlaybackBusy
      ? "Running…"
      : mode === "online"
        ? sequenceMode ? "▶ Run sequence online" : "▶ Run range online"
        : sequenceMode ? "▶ Preview sequence" : "▶ Preview range";
}

function renderCatalogActionLibrary() {
  if (!catalogActionLibrary) {
    elements.catalogActionCount.textContent = "Library unavailable";
    updateCatalogControls();
    return;
  }

  const groups = [...catalogActionLibrary.groups].sort((a, b) => Number(a.id) - Number(b.id));
  const firstId = groups.length ? String(groups[0].id) : "";
  const previousStart = elements.catalogStartGroup.value;
  const previousEnd = elements.catalogEndGroup.value;
  for (const select of [elements.catalogStartGroup, elements.catalogEndGroup]) {
    select.replaceChildren();
    for (const group of groups) {
      const option = document.createElement("option");
      option.value = String(group.id);
      option.textContent = `G${String(group.id).padStart(4, "0")}`;
      select.append(option);
    }
  }
  elements.catalogStartGroup.value = groups.some((group) => String(group.id) === previousStart) ? previousStart : firstId;
  elements.catalogEndGroup.value = groups.some((group) => String(group.id) === previousEnd) ? previousEnd : firstId;
  elements.catalogActionCount.textContent = `${groups.length} GROUPS`;

  const rows = document.createDocumentFragment();
  for (const action of catalogActionLibrary.actions || []) {
    const actionGroups = groups.filter((group) =>
      Number(group.id) >= Number(action.start_group) && Number(group.id) <= Number(action.end_group));
    if (!actionGroups.length) continue;
    const actionLabel = getCatalogActionLabel(action);
    const categoryRow = document.createElement("tr");
    categoryRow.className = "catalog-category-row";
    const categoryCell = document.createElement("th");
    categoryCell.colSpan = 15;
    categoryCell.scope = "rowgroup";
    const categoryButton = document.createElement("button");
    categoryButton.type = "button";
    categoryButton.className = "catalog-category-button";
    categoryButton.dataset.startGroup = String(action.start_group);
    categoryButton.dataset.endGroup = String(action.end_group);
    categoryButton.title = "Select this action's full group range";
    categoryButton.textContent = `${actionLabel} · G${String(action.start_group).padStart(4, "0")}`
      + (Number(action.end_group) === Number(action.start_group)
        ? ""
        : `–G${String(action.end_group).padStart(4, "0")}`);
    categoryButton.addEventListener("click", () => selectCatalogRange(action.start_group, action.end_group));
    categoryCell.append(categoryButton);
    categoryRow.append(categoryCell);
    rows.append(categoryRow);

    for (const group of actionGroups) {
      const row = document.createElement("tr");
      const groupId = Number(group.id);
      row.dataset.groupId = String(groupId);
      row.tabIndex = 0;
      row.setAttribute("aria-label", `Select group G${String(groupId).padStart(4, "0")}`);
      row.addEventListener("click", () => selectCatalogRange(groupId, groupId));
      row.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          row.click();
        }
      });

      const issues = catalogGroupIssues(group);
      const actionCell = document.createElement("td");
      actionCell.textContent = actionLabel;
      const reviewCell = document.createElement("td");
      reviewCell.className = "catalog-review";
      reviewCell.dataset.state = issues.length ? "blocked" : "clear";
      reviewCell.textContent = issues.length ? "BLOCKED" : "REVIEW";
      if (issues.length) reviewCell.title = issues.join("; ");
      const cells = [
        `G${String(groupId).padStart(4, "0")}`,
        actionCell,
        reviewCell,
      ];
      for (let servoIndex = 0; servoIndex < 6; servoIndex += 1) {
        const pwmCell = document.createElement("td");
        pwmCell.textContent = String(group.pwm?.[servoIndex] ?? "—");
        const timeCell = document.createElement("td");
        timeCell.textContent = String(group.time_ms?.[servoIndex] ?? "—");
        cells.push(pwmCell, timeCell);
      }
      for (const [index, cell] of cells.entries()) {
        const tableCell = cell instanceof HTMLElement ? cell : document.createElement("td");
        if (!(cell instanceof HTMLElement)) tableCell.textContent = String(cell);
        if (index === 0) tableCell.className = "catalog-group-id";
        row.append(tableCell);
      }
      rows.append(row);
    }
  }

  elements.catalogActionRows.replaceChildren(rows);
  renderCatalogDemoSequence();
  updateCatalogSelection();
}

function selectCatalogRange(start, end) {
  if (catalogPlaybackBusy) return;
  elements.catalogStartGroup.value = String(start);
  elements.catalogEndGroup.value = String(end);
  updateCatalogSelection();
}

function updateCatalogSelection() {
  const start = Number(elements.catalogStartGroup.value);
  const end = Number(elements.catalogEndGroup.value);
  for (const row of elements.catalogActionRows.querySelectorAll("tr[data-group-id]")) {
    const groupId = Number(row.dataset.groupId);
    row.classList.toggle("is-selected", groupId >= start && groupId <= end);
  }
  for (const button of elements.catalogActionRows.querySelectorAll(".catalog-category-button")) {
    const selected = Number(button.dataset.startGroup) === start && Number(button.dataset.endGroup) === end;
    button.setAttribute("aria-pressed", String(selected));
  }
  updateCatalogControls();
}

async function loadCatalogActionLibrary() {
  const data = await apiRequest("/api/catalog-action-groups");
  if (!Array.isArray(data.groups) || !Array.isArray(data.actions)) {
    throw new Error("Recorded action group data has an invalid format.");
  }
  catalogActionLibrary = data;
  renderCatalogActionLibrary();
}

function waitForPreview(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function applyActionProgress(data, playback, roundTripMs = 0) {
  const progress = data.progress;
  if (!progress || progress.group_id !== playback.groupId
    || progress.execution_id === playback.previousExecutionId) return;
  controllerBusy = Boolean(data.busy);
  if (sequenceStopRequested) return;

  const stageKey = `${progress.execution_id}:${progress.stage_index}`;
  const phaseKey = `${stageKey}:${progress.phase}`;
  if (phaseKey !== playback.phaseKey) {
    updateJointControls(data.servos || []);
    playback.phaseKey = phaseKey;
  }
  if (["stopped", "error", "position_error"].includes(progress.phase)) {
    modelAnimations.clear();
    if (progress.phase === "stopped") sequenceStopRequested = true;
    elements.motionState.textContent = progress.phase === "stopped" ? "PLAYBACK STOPPED" : "PLAYBACK ERROR";
    return;
  }
  if (stageKey !== playback.stageKey) {
    modelAnimations.clear();
    for (const [id, angle] of Object.entries(progress.start_angles_deg || {})) {
      if (Number.isFinite(angle)) setModelJointAngle(Number(id), angle);
    }
    playback.stageKey = stageKey;
  }

  const axes = (progress.servo_ids || []).map((id) => `J${Number(id) + 1}`).join(" + ");
  if (progress.phase === "moving" || progress.phase === "reading") {
    const durationMs = Number(progress.duration_ms);
    const elapsedMs = progress.phase === "reading" ? durationMs
      : Math.min(durationMs, Number(progress.elapsed_ms) + Math.min(roundTripMs / 2, 200));
    for (const id of progress.servo_ids || []) {
      const fromAngle = progress.start_angles_deg?.[String(id)];
      const targetAngle = progress.target_angles_deg?.[String(id)];
      if (!Number.isFinite(fromAngle) || !Number.isFinite(targetAngle)) continue;
      animateModelJoint(Number(id), targetAngle, durationMs, { fromAngle, elapsedMs, linear: true });
    }
    const phase = progress.phase === "reading" ? "READBACK" : axes;
    elements.motionState.textContent = `STAGE ${progress.stage_index}/${progress.stage_count} · ${phase}`;
  } else if (progress.phase === "stage_complete" || progress.phase === "complete") {
    modelAnimations.clear();
    for (const servo of data.servos || []) {
      if (servo.online && Number.isFinite(servo.angle_deg)) setModelJointAngle(Number(servo.id), servo.angle_deg);
    }
    elements.motionState.textContent = progress.phase === "complete" ? "GROUP COMPLETE"
      : `STAGE ${progress.stage_index}/${progress.stage_count} COMPLETE`;
  } else {
    elements.motionState.textContent = "PREPARING GROUP";
  }
}

async function executeActionGroup(groupId, refreshBefore = true) {
  offlinePreviewPoseHeld = false;
  // This endpoint reads cached telemetry only; it never queries the servo bus.
  const previous = await apiRequest("/api/motion-progress", { signal: AbortSignal.timeout(1500), cache: "no-store" });
  if (sequenceStopRequested) return { status: "stopped" };
  const playback = {
    groupId,
    previousExecutionId: previous.progress?.execution_id,
    active: true,
    abort: null,
    stageKey: null,
    phaseKey: null,
    syncLost: false,
  };
  modelAnimations.clear();
  const polling = (async () => {
    while (playback.active) {
      playback.abort = new AbortController();
      const timeout = window.setTimeout(() => playback.abort.abort(), 1500);
      const requestedAt = performance.now();
      try {
        const data = await apiRequest("/api/motion-progress", { signal: playback.abort.signal, cache: "no-store" });
        if (playback.active) {
          applyActionProgress(data, playback, performance.now() - requestedAt);
          playback.syncLost = false;
        }
      } catch (error) {
        if (playback.active && !sequenceStopRequested) {
          modelAnimations.clear();
          elements.motionState.textContent = "3D SYNC INTERRUPTED";
          if (!playback.syncLost) showToast("3D synchronization interrupted. Arm playback may still be active.", "error");
          playback.syncLost = true;
        }
      } finally {
        window.clearTimeout(timeout);
      }
      if (playback.active) await waitForPreview(80);
    }
  })();
  try {
    return await apiRequest(`/api/action-groups/${encodeURIComponent(groupId)}/play`, {
      method: "POST",
      body: JSON.stringify({ refresh_before: refreshBefore }),
    });
  } finally {
    playback.active = false;
    playback.abort?.abort();
    await polling;
    modelAnimations.clear();
    try {
      const finalState = await apiRequest("/api/motion-progress", { signal: AbortSignal.timeout(1500), cache: "no-store" });
      if (["complete", "stage_complete"].includes(finalState.progress?.phase)) applyActionProgress(finalState, playback);
    } catch {
      // Hold the last known pose until the normal state refresh succeeds.
    }
  }
}

async function previewCatalogGroups(groups, repeatCount, sequenceMode = false) {
  if (getCatalogRunMode() !== "preview") {
    showToast("All six servos are online; the mode has switched to online run.", "info");
    return;
  }
  if (commandBusy || controllerBusy || catalogPlaybackBusy || recordingDraft
    || !elements.modelSummary.classList.contains("is-loaded")) return;
  offlinePreviewPoseHeld = true;
  catalogPlaybackBusy = true;
  activeCatalogRunMode = "preview";
  catalogPreviewStopRequested = false;
  updateActionControls();
  for (const slider of elements.jointList.querySelectorAll("input[type=range]")) slider.disabled = true;

  try {
    for (let repeat = 0; repeat < repeatCount && !catalogPreviewStopRequested; repeat += 1) {
      for (const group of groups) {
        if (catalogPreviewStopRequested) break;
        const groupCode = `G${String(group.id).padStart(4, "0")}`;
        if (group.approach_servo_ids?.length) {
          const approachDurationMs = Math.max(...group.time_ms.map(Number), 300);
          for (const servoId of group.approach_servo_ids) {
            const index = catalogActionLibrary.servo_ids.indexOf(servoId);
            if (index < 0) continue;
            animateModelJoint(servoId, catalogPwmToAngle(servoId, group.pwm[index]), approachDurationMs);
          }
          elements.catalogRunStatus.textContent = `${sequenceMode ? "Sequence · " : ""}Offline preview ${groupCode} · unfold elbow / wrist`;
          await waitForPreview(approachDurationMs);
          if (catalogPreviewStopRequested) break;
        }
        group.pwm.forEach((pwm, index) => {
          const servoId = Number(catalogActionLibrary.servo_ids[index]);
          animateModelJoint(servoId, catalogPwmToAngle(servoId, pwm), Number(group.time_ms[index]));
        });
        elements.catalogRunStatus.textContent = `${sequenceMode ? "Sequence · " : ""}Offline preview ${groupCode} · ${repeat + 1}/${repeatCount}`;
        await waitForPreview(Math.max(...group.time_ms.map(Number), 300));
      }
    }
    elements.catalogRunStatus.textContent = catalogPreviewStopRequested
      ? "Offline preview stopped."
      : sequenceMode
        ? `Previewed demo sequence: ${groups.length} groups × ${repeatCount}. Hardware was not moved.`
        : `Previewed ${groups.length} groups × ${repeatCount}. Hardware was not moved.`;
  } finally {
    updateModelAnimations();
    modelAnimations.clear();
    catalogPlaybackBusy = false;
    activeCatalogRunMode = null;
    updateActionControls();
  }
}

async function runCatalogGroupsOnline(groups, repeatCount, sequenceMode = false) {
  if (controllerBackend === "mock") {
    showToast("Online run requires a real controller connection.", "info");
    return;
  }
  const blocked = groups
    .map((group) => ({ group, issues: catalogGroupIssues(group) }))
    .filter((item) => item.issues.length);
  if (blocked.length) {
    const blockedText = blocked.map(({ group }) => `G${String(group.id).padStart(4, "0")}`).join(", ");
    elements.catalogRunStatus.textContent = `Blocked before motion: ${blockedText}`;
    showToast(`Selected range contains blocked groups: ${blockedText}. No motion was started.`, "error");
    return;
  }
  if (!apiConnected || !allJointsOnline() || commandBusy || controllerBusy) {
    showToast("All six joints must be connected and idle before online playback.", "error");
    return;
  }

  catalogPlaybackBusy = true;
  activeCatalogRunMode = "online";
  commandBusy = true;
  sequenceStopRequested = false;
  elements.stopButton.disabled = false;
  elements.motionState.textContent = sequenceMode ? "PLAYING DEMO SEQUENCE" : "PLAYING ACTION GROUPS";
  updateActionControls();
  try {
    let completed = 0;
    for (let repeat = 0; repeat < repeatCount && !sequenceStopRequested; repeat += 1) {
      for (const [groupIndex, group] of groups.entries()) {
        if (sequenceStopRequested) break;
        const groupId = Number(group.id);
        const groupCode = `G${String(groupId).padStart(4, "0")}`;
        elements.catalogRunStatus.textContent = sequenceMode
          ? `Sequence ${groupIndex + 1}/${groups.length} · ${groupCode} · ${repeat + 1}/${repeatCount}`
          : `Online run ${groupCode} · ${repeat + 1}/${repeatCount}`;
        elements.footerMessage.textContent = `Playing ${groupCode}`;
        const result = await executeActionGroup(
          `catalog-${String(groupId).padStart(4, "0")}`,
          completed === 0,
        );
        if (result.status === "stopped") sequenceStopRequested = true;
        if (sequenceStopRequested) break;
        if (result.status === "position_error") {
          throw new Error(`${groupCode}: joint ${Number(result.servo_id) + 1} missed its target.`);
        }
        completed += 1;
      }
    }
    elements.motionState.textContent = sequenceStopRequested ? "PLAYBACK STOPPED"
      : sequenceMode ? "SEQUENCE COMPLETE" : "GROUPS COMPLETE";
    elements.catalogRunStatus.textContent = sequenceStopRequested
      ? `${sequenceMode ? "Sequence" : "Online playback"} stopped after ${completed} group(s).`
      : sequenceMode ? `Demo sequence finished ${completed} group(s).` : `Finished ${completed} group(s).`;
    elements.footerMessage.textContent = sequenceStopRequested
      ? sequenceMode ? "Demo sequence stopped." : "Action group playback stopped."
      : sequenceMode ? "Demo sequence finished." : `Finished ${completed} action group(s)`;
    showToast(sequenceStopRequested
      ? sequenceMode ? "Demo sequence stopped." : "Action group playback stopped."
      : sequenceMode ? "Demo sequence finished." : "Action groups finished.", "info");
  } catch (error) {
    elements.catalogRunStatus.textContent = error.message;
    elements.footerMessage.textContent = error.message;
    showToast(error.message, "error");
  } finally {
    commandBusy = false;
    catalogPlaybackBusy = false;
    activeCatalogRunMode = null;
    await refreshState();
    elements.stopButton.disabled = !apiConnected || !commandBusy;
    updateActionControls();
  }
}

async function runCatalogPlayback() {
  if (catalogPlaybackBusy) {
    if (!commandBusy) catalogPreviewStopRequested = true;
    return;
  }
  const sequenceMode = elements.catalogPlaybackTarget.value === "sequence";
  let groups;
  if (sequenceMode) {
    if (!catalogDemoSequence.length || !catalogActionLibrary) {
      showToast("Add at least one available range to the demo sequence.", "error");
      return;
    }
    groups = catalogDemoSequence.flatMap((step) => getCatalogGroupsInRange(step.start, step.end));
    if (!groups.length || catalogDemoSequence.some((step) => !getCatalogGroupsInRange(step.start, step.end).length)) {
      showToast("The demo sequence contains an unavailable range. Remove it before running.", "error");
      return;
    }
  } else {
    groups = getSelectedCatalogGroups();
  }
  const repeatCount = Number(elements.catalogRepeatCount.value);
  if (!groups.length || !Number.isInteger(repeatCount) || repeatCount < 1 || repeatCount > 20) {
    showToast(sequenceMode
      ? "Choose a valid demo sequence and repeat count (1–20)."
      : "Choose a valid group range and repeat count (1–20).", "error");
    return;
  }
  const mode = getCatalogRunMode();
  if (mode === "online") {
    await runCatalogGroupsOnline(groups, repeatCount, sequenceMode);
  } else {
    await previewCatalogGroups(groups, repeatCount, sequenceMode);
  }
}

function beginActionRecording() {
  const name = elements.actionName.value.trim();
  if (!name) {
    showToast("Enter a name for this action group.", "error");
    elements.actionName.focus();
    return;
  }
  if (!allJointsOnline() || commandBusy) {
    showToast("All six joints must be online and idle to record.", "error");
    return;
  }
  recordingDraft = { name, frames: [] };
  renderRecordedPoses();
  updateActionControls();
  showToast("Recording started. Move the joints and capture each pose.", "success");
}

function captureActionPose() {
  if (!recordingDraft || commandBusy) return;
  const angles = currentPoseAngles();
  if (angles.some((angle) => angle === null)) {
    showToast("Current pose is unavailable until all six joints are online.", "error");
    return;
  }
  const previous = recordingDraft.frames.at(-1);
  if (previous && previous.angles_deg.every((angle, index) => Math.abs(angle - angles[index]) < 0.25)) {
    showToast("This pose matches the previous capture.", "info");
    return;
  }
  recordingDraft.frames.push({
    angles_deg: angles,
    duration_ms: Number(elements.poseDuration.value),
  });
  renderRecordedPoses();
  updateActionControls();
}

function cancelActionRecording() {
  recordingDraft = null;
  renderRecordedPoses();
  updateActionControls();
}

async function saveActionRecording() {
  if (!recordingDraft || recordingDraft.frames.length === 0) return;
  elements.recordSave.disabled = true;
  try {
    const data = await apiRequest("/api/action-groups", {
      method: "POST",
      body: JSON.stringify(recordingDraft),
    });
    actionGroups = [...actionGroups, data.group];
    recordingDraft = null;
    elements.actionName.value = "";
    renderRecordedPoses();
    renderActionGroups();
    showToast("Action group saved.", "success");
  } catch (error) {
    showToast(error.message, "error");
  } finally {
    updateActionControls();
  }
}

async function deleteActionGroup(group) {
  if (!window.confirm(localization.translate(`Delete "${group.name}"?`))) return;
  try {
    await apiRequest(`/api/action-groups/${encodeURIComponent(group.id)}`, { method: "DELETE" });
    actionGroups = actionGroups.filter((item) => item.id !== group.id);
    renderActionGroups();
    showToast("Action group deleted.", "success");
  } catch (error) {
    showToast(error.message, "error");
  }
}

async function playActionGroup(group) {
  if (commandBusy || !apiConnected || recordingDraft) return;
  sequenceStopRequested = false;
  commandBusy = true;
  elements.stopButton.disabled = false;
  elements.motionState.textContent = "PLAYING GROUP";
  elements.footerMessage.textContent = `Playing ${group.name}`;
  updateActionControls();
  try {
    const result = await executeActionGroup(String(group.id));
    if (result.status === "stopped" || sequenceStopRequested) {
      showToast("Playback stopped.", "info");
    } else if (result.status === "position_error") {
      const jointNumber = Number(result.servo_id) + 1;
      const message = `Playback stopped: joint ${jointNumber} did not reach its target.`;
      elements.footerMessage.textContent = message;
      showToast(message, "error");
    } else {
      elements.motionState.textContent = "GROUP COMPLETE";
      elements.footerMessage.textContent = `Finished ${group.name}`;
      if (result.contact_ids?.length) {
        showToast(`Finished ${group.name}; gripper contact was detected.`, "info");
      } else {
        showToast(`Finished ${group.name}.`, "success");
      }
    }
  } catch (error) {
    elements.footerMessage.textContent = error.message;
    showToast(error.message, "error");
  } finally {
    commandBusy = false;
    elements.stopButton.disabled = !apiConnected;
    await refreshState();
    updateActionControls();
  }
}

function updateManualPanel() {
  const open = manualControlMode !== "closed";
  const single = manualControlMode === "joint";
  elements.manualPanel.hidden = !open;
  elements.manualPanel.classList.toggle("is-single-joint", single);
  elements.manualToggle.setAttribute("aria-expanded", String(open));
  elements.manualToggle.classList.toggle("is-active", open);
  elements.manualToggle.title = manualControlMode === "all" ? "Close manual controls" : "Show all six joint controls";
  elements.jointHeading.textContent = single ? `J${selectedJointId + 1} control` : "Joint positions";
  elements.manualHint.textContent = single
    ? "Drag the slider to set a target. Release to move this joint."
    : "Select a joint below, or click a joint in the 3D model.";
  for (const card of elements.jointList.querySelectorAll("[data-joint-id]")) {
    card.hidden = single && Number(card.dataset.jointId) !== selectedJointId;
  }
}

function openManualPanel(mode = "all", jointId = null, anchor = null) {
  if (mode === "joint" && !jointState.has(Number(jointId))) return;
  const bounds = elements.canvasHost.getBoundingClientRect();
  elements.manualPanel.classList.toggle("is-top-aligned", mode === "joint" && anchor
    && anchor.clientY > bounds.top + bounds.height / 2);
  manualControlMode = mode;
  if (mode === "joint") selectJointControl(Number(jointId));
  updateManualPanel();
  elements.manualClose.focus({ preventScroll: true });
}

function closeManualPanel(restoreFocus = true) {
  manualControlMode = "closed";
  updateManualPanel();
  if (restoreFocus) elements.manualToggle.focus({ preventScroll: true });
}

function renderJointControls() {
  elements.jointList.replaceChildren();
  for (const joint of jointState.values()) {
    const isGripper = joint.id === 5;
    const leftLabel = isGripper ? "OPEN" : `${joint.min_deg.toFixed(1)}°`;
    const rightLabel = isGripper ? "CLOSE" : `${joint.max_deg.toFixed(1)}°`;
    const sliderLabel = isGripper ? "Gripper open to close" : `${joint.name} target angle`;
    const card = document.createElement("article");
    card.className = "joint-card";
    card.dataset.jointId = String(joint.id);
    card.dataset.online = String(joint.online);
    card.classList.toggle("is-selected", selectedJointId === joint.id);
    card.innerHTML = `
      <div class="joint-topline">
        <div class="joint-name-wrap">
          <span class="joint-id">J${joint.id + 1}</span>
          <div>
            <div class="joint-name">${joint.name}</div>
            <div class="joint-hw-id">SERVO ID ${String(joint.id).padStart(3, "0")}</div>
          </div>
        </div>
        <div class="joint-readouts">
          <div class="joint-readout">
            <span class="joint-readout-caption">CURRENT</span>
            <span class="joint-current" data-current>OFFLINE</span>
            <span class="joint-pwm" data-current-pwm>— µs</span>
          </div>
          <div class="joint-readout joint-readout-target">
            <span class="joint-readout-caption">TARGET</span>
            <span class="joint-target" data-target>0<small>°</small></span>
            <span class="joint-pwm joint-pwm-target" data-target-pwm>${angleToPwm(joint, 0)} µs</span>
          </div>
        </div>
      </div>
      <div class="joint-slider-line">
        <span class="joint-limit" data-min>${leftLabel}</span>
        <input class="joint-slider" data-slider type="range" min="${joint.min_deg}" max="${joint.max_deg}" value="0" step="any" aria-label="${sliderLabel}" disabled />
        <span class="joint-limit" data-max>${rightLabel}</span>
      </div>
      <div class="joint-error" data-error></div>
    `;

    const slider = card.querySelector("[data-slider]");
    const target = card.querySelector("[data-target]");
    const targetPwm = card.querySelector("[data-target-pwm]");
    const error = card.querySelector("[data-error]");
    card.addEventListener("click", () => selectJointControl(joint.id));
    slider.addEventListener("input", () => {
      const angle = Number(slider.value);
      target.innerHTML = `${angle.toFixed(1)}<small>°</small>`;
      targetPwm.textContent = `${angleToPwm(joint, angle)} µs`;
      if (isGripper) animateModelJoint(joint.id, angle, 120);
    });
    slider.addEventListener("change", async () => {
      if (!apiConnected || commandBusy) return;
      error.textContent = "";
      axisCheckSample = null;
      await moveJoint(joint.id, Number(slider.value), card);
    });
    elements.jointList.append(card);
  }
  updateManualPanel();
  updateActionControls();
}

function selectJointControl(jointId, scrollIntoView = false) {
  const resolvedId = Number(jointId);
  if (!Number.isInteger(resolvedId) || !jointState.has(resolvedId)) return;
  selectedJointId = resolvedId;
  elements.checkJoint.value = String(resolvedId);
  updateManualPanel();
  for (const card of elements.jointList.querySelectorAll("[data-joint-id]")) {
    const selected = Number(card.dataset.jointId) === resolvedId;
    card.classList.toggle("is-selected", selected);
    if (selected && scrollIntoView && !elements.manualPanel.hidden) {
      elements.jointList.scrollTo({ top: card.offsetTop - elements.jointList.offsetTop, behavior: "smooth" });
    }
  }
  updateAxisCheck();
}

function updateJointControls(servos, controllerState = null) {
  if (controllerState) {
    controllerBackend = controllerState.backend ?? controllerBackend;
    if (controllerBackend !== "mock") offlinePreviewPoseHeld = false;
    elements.modelModeLabel.textContent = modelDisplayMode === "step"
      ? controllerBackend === "mock" ? "SIMULATION" : "LIVE MODEL"
      : modelDisplayMode === "loading" ? "LOADING MODEL" : "MODEL REQUIRED";
    controllerBusy = Boolean(controllerState.busy);
    updateReference(controllerState.calibration);
  }
  for (const servo of servos) {
    const joint = jointState.get(Number(servo.id));
    if (!joint) continue;
    const displayName = joint.name || `Joint ${Number(servo.id) + 1}`;
    Object.assign(joint, servo);
    joint.name = displayName;
    const card = elements.jointList.querySelector(`[data-joint-id="${servo.id}"]`);
    if (!card) continue;
    card.dataset.online = String(Boolean(servo.online));
    const current = card.querySelector("[data-current]");
    const currentPwm = card.querySelector("[data-current-pwm]");
    const target = card.querySelector("[data-target]");
    const targetPwm = card.querySelector("[data-target-pwm]");
    const slider = card.querySelector("[data-slider]");
    slider.min = String(joint.min_deg);
    slider.max = String(joint.max_deg);
    if (joint.id !== 5) {
      card.querySelector("[data-min]").textContent = `${joint.min_deg.toFixed(1)}°`;
      card.querySelector("[data-max]").textContent = `${joint.max_deg.toFixed(1)}°`;
    }
    const error = card.querySelector("[data-error]");
    const angle = Number.isFinite(servo.angle_deg) ? Number(servo.angle_deg) : null;
    current.textContent = angle === null ? (servo.online ? "—" : "OFFLINE") : `${angle.toFixed(1)}°`;
    currentPwm.textContent = Number.isFinite(servo.pwm) ? `${Math.round(Number(servo.pwm))} µs` : "— µs";
    if (angle !== null && !slider.matches(":active")) {
      slider.value = String(angle);
      target.innerHTML = `${angle.toFixed(1)}<small>°</small>`;
      targetPwm.textContent = `${angleToPwm(joint, angle)} µs`;
      if (!commandBusy && !catalogPlaybackBusy && !offlinePreviewPoseHeld) setModelJointAngle(Number(servo.id), angle);
    }
    slider.disabled = !apiConnected || commandBusy || controllerBusy || catalogPlaybackBusy || !servo.online;
    if (servo.status === "contact") {
      error.textContent = "Contact detected · target not reached";
    } else if (servo.status === "error") {
      error.textContent = servo.error || "Readback error";
    } else if (localization.getSourceText(error).includes("Contact detected")
      || localization.getSourceText(error) === "Readback error"
      || (servo.status === "ready" && localization.getSourceText(error).includes("Position read failed"))) {
      error.textContent = "";
    }
  }
  const online = servos.filter((servo) => servo.online).length;
  elements.onlineCount.textContent = `${online} / 6`;
  elements.stopButton.disabled = !apiConnected || !(commandBusy || controllerBusy);
  elements.motionState.textContent = commandBusy
    ? "MOVING"
    : controllerState?.active_action_id
      ? "GROUP ACTIVE"
      : controllerState?.active_id === null || controllerState?.active_id === undefined
        ? controllerBusy ? "BUSY" : "IDLE"
        : `J${Number(controllerState.active_id) + 1} ACTIVE`;
  const locale = document.documentElement.lang === "zh-CN" ? "zh-CN" : "en-US";
  elements.lastUpdate.textContent = new Date().toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  updateActionControls();
}

async function connectToController() {
  elements.connectButton.disabled = true;
  elements.connectButton.textContent = "Connecting…";
  try {
    const data = await apiRequest("/api/state");
    apiConnected = true;
    controllerBackend = data.backend ?? null;
    setConnection("online", "CONNECTED");
    const connectionMode = data.backend === "mock" ? "SIMULATION" : "SERVO BUS";
    elements.backendLabel.textContent = `${connectionMode} · ${data.baudrate || 115200} BAUD`;
    elements.footerMessage.textContent = "Controller connected · manual commands enabled";
    updateJointControls(data.servos || [], data);
    await loadActionGroups().catch((error) => showToast(error.message, "error"));
    await loadCatalogActionLibrary().catch((error) => {
      elements.catalogActionCount.textContent = "Groups unavailable";
      elements.catalogRunStatus.textContent = error.message;
      showToast(error.message, "error");
    });
    showToast("Controller connected", "success");
    if (pollTimer) window.clearInterval(pollTimer);
    pollTimer = window.setInterval(refreshState, 10000);
  } catch (error) {
    apiConnected = false;
    setConnection("error", "LINK ERROR");
    elements.footerMessage.textContent = error.message;
    elements.onlineCount.textContent = "— / 6";
    renderJointControls();
    updateActionControls();
    showToast(error.message, "error");
  } finally {
    elements.connectButton.disabled = false;
    elements.connectButton.textContent = "Reconnect";
  }
}

async function refreshState() {
  if (!apiConnected || commandBusy || catalogPlaybackBusy) return;
  try {
    const data = await apiRequest("/api/state");
    updateJointControls(data.servos || [], data);
  } catch (error) {
    apiConnected = false;
    setConnection("error", "LINK ERROR");
    elements.footerMessage.textContent = error.message;
    renderJointControls();
    updateActionControls();
  }
}

async function moveJoint(id, angle, card) {
  offlinePreviewPoseHeld = false;
  commandBusy = true;
  card.classList.add("is-busy");
  elements.motionState.textContent = `J${id + 1} MOVING`;
  elements.stopButton.disabled = false;
  for (const slider of elements.jointList.querySelectorAll("input[type=range]")) slider.disabled = true;
  const durationMs = id === 1 || id === 2 ? 1400 : 1000;
  updateActionControls();
  animateModelJoint(id, angle, durationMs);
  try {
    const result = await apiRequest(`/api/joints/${id}/move`, {
      method: "POST",
      body: JSON.stringify({ angle_deg: angle, duration_ms: durationMs }),
    });
    if (result.servo) {
      updateJointControls([result.servo]);
      if (Number.isFinite(result.servo.angle_deg)) animateModelJoint(id, Number(result.servo.angle_deg), 180);
    }
    if (result.status === "contact") {
      showToast("Gripper contact detected; position feedback may stop short of the target.", "info");
    } else if (result.status === "position_error") {
      showToast(result.message || "Motion stopped because position error exceeded the limit.", "error");
    }
    elements.footerMessage.textContent = `J${id + 1} command complete · target ${angle.toFixed(1)}°`;
    return result;
  } catch (error) {
    const currentAngle = jointState.get(id)?.angle_deg ?? 0;
    animateModelJoint(id, currentAngle, 180);
    const errorElement = card.querySelector("[data-error]");
    errorElement.textContent = error.message;
    elements.footerMessage.textContent = error.message;
    showToast(error.message, "error");
  } finally {
    commandBusy = false;
    card.classList.remove("is-busy");
    await refreshState();
    elements.stopButton.disabled = !apiConnected || !commandBusy;
    updateActionControls();
  }
}

async function stopMotion() {
  if (!apiConnected) return;
  sequenceStopRequested = true;
  modelAnimations.clear();
  elements.stopButton.disabled = true;
  try {
    await apiRequest("/api/stop", { method: "POST", body: "{}" });
    elements.motionState.textContent = "STOP SENT";
    elements.footerMessage.textContent = "Stop command sent to all managed servos";
    showToast("Stop command sent", "success");
  } catch (error) {
    showToast(error.message, "error");
  } finally {
    elements.stopButton.disabled = !apiConnected || !commandBusy;
  }
}

elements.connectButton.addEventListener("click", connectToController);
elements.manualToggle.addEventListener("click", () => {
  if (manualControlMode === "all") closeManualPanel();
  else openManualPanel("all");
});
elements.manualClose.addEventListener("click", () => closeManualPanel());
document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  if (elements.calibrationPanel.open && elements.calibrationPanel.contains(document.activeElement)) {
    elements.calibrationPanel.open = false;
    elements.calibrationToggle.focus({ preventScroll: true });
  } else if (manualControlMode !== "closed") {
    closeManualPanel();
  }
});
elements.refreshButton.addEventListener("click", refreshState);
elements.stopButton.addEventListener("click", stopMotion);
elements.recordStart.addEventListener("click", beginActionRecording);
elements.capturePose.addEventListener("click", captureActionPose);
elements.recordCancel.addEventListener("click", cancelActionRecording);
elements.recordSave.addEventListener("click", saveActionRecording);
elements.catalogStartGroup.addEventListener("change", () => {
  if (Number(elements.catalogStartGroup.value) > Number(elements.catalogEndGroup.value)) {
    elements.catalogEndGroup.value = elements.catalogStartGroup.value;
  }
  updateCatalogSelection();
});
elements.catalogEndGroup.addEventListener("change", () => {
  if (Number(elements.catalogEndGroup.value) < Number(elements.catalogStartGroup.value)) {
    elements.catalogStartGroup.value = elements.catalogEndGroup.value;
  }
  updateCatalogSelection();
});
elements.catalogRepeatCount.addEventListener("input", updateCatalogControls);
elements.catalogPlaybackTarget.addEventListener("change", updateCatalogControls);
elements.catalogRun.addEventListener("click", runCatalogPlayback);
elements.catalogSequenceAdd.addEventListener("click", addSelectedRangeToDemoSequence);
elements.catalogSequenceClear.addEventListener("click", clearCatalogDemoSequence);
elements.catalogRefresh.addEventListener("click", () => {
  loadCatalogActionLibrary().catch((error) => {
    elements.catalogRunStatus.textContent = error.message;
    showToast(error.message, "error");
  });
});
elements.checkJoint.addEventListener("change", () => selectJointControl(Number(elements.checkJoint.value), true));
elements.checkStep.addEventListener("change", updateAxisCheck);
elements.checkMinus.addEventListener("click", () => moveCheckAxis(-Number(elements.checkStep.value)));
elements.checkPlus.addEventListener("click", () => moveCheckAxis(Number(elements.checkStep.value)));
elements.checkZero.addEventListener("click", () => moveCheckAxis(0));
elements.checkMatch.addEventListener("click", () => markAxisCheck("match"));
elements.checkMismatch.addEventListener("click", () => markAxisCheck("mismatch"));
connectToController();
renderJointControls();
renderActionGroups();
renderCatalogDemoSequence();
setConnection("offline", "DISCONNECTED");

// Three.js viewport for the project Jibot1 STEP model.
const DEFAULT_CAMERA_VIEW = {
  position: [0.15289882377817365, -873.9920172432135, 416.61343940396637],
  target: [0, 0, 0],
  up: [0, 0, 1],
  fov: 42,
  zoom: 1,
};
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x23364c);
const camera = new THREE.PerspectiveCamera(DEFAULT_CAMERA_VIEW.fov, 1, 0.1, 100000);
camera.up.fromArray(DEFAULT_CAMERA_VIEW.up);
camera.position.fromArray(DEFAULT_CAMERA_VIEW.position);

const STATIC_RENDER_PIXEL_RATIO = Math.min(window.devicePixelRatio || 1, 1.25);
const INTERACTION_RENDER_PIXEL_RATIO = Math.min(window.devicePixelRatio || 1, 1);
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "low-power" });
renderer.setPixelRatio(STATIC_RENDER_PIXEL_RATIO);
renderer.setClearColor(0x23364c, 1);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
elements.canvasHost.appendChild(renderer.domElement);

scene.add(new THREE.HemisphereLight(0xcfe3ff, 0x202a3a, 2.0));
const keyLight = new THREE.DirectionalLight(0xffffff, 2.4);
keyLight.position.set(700, -850, 1200);
scene.add(keyLight);
const fillLight = new THREE.DirectionalLight(0x7dbaff, 1.0);
fillLight.position.set(-900, 600, 450);
scene.add(fillLight);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.065;
controls.screenSpacePanning = false;
controls.minDistance = 150;
controls.maxDistance = 10000;
controls.target.fromArray(DEFAULT_CAMERA_VIEW.target);

const grid = new THREE.GridHelper(1800, 36, 0x6683a3, 0x48647f);
grid.rotation.x = Math.PI / 2;
grid.position.z = -360;
grid.material.transparent = true;
grid.material.opacity = 0.45;
scene.add(grid);
const axes = new THREE.AxesHelper(180);
axes.material.depthTest = false;
axes.renderOrder = 5;
scene.add(axes);

let cadAssembly = null;
let modelRadius = 450;
let modelCentered = false;
const modelCenter = new THREE.Vector3();
let articulatedModelAvailable = false;
const modelJointPivots = new Map();
const modelJointAngles = new Map(DEFAULT_JOINTS.map((joint) => [joint.id, 0]));
const modelAnimations = new Map();

// STEP-local pivots estimated from the servo and bracket solids. PWM 1500 is the
// assembly reference pose; signs and pivot centers still need physical calibration.
const CAD_JOINTS = [
  // The assembly is rotated by -90° around Y at load time, so STEP-local +X
  // becomes the world-space vertical axis used by the physical base yaw joint.
  // The STEP bearing/horn center is at Y=-55, Z≈60.727; use that axis line
  // so Joint 1 rotates concentrically over the circular turntable.
  { id: 0, pivot: [55.7, -55.0, 60.726942861875], axis: [1, 0, 0], polarity: 1 },
  { id: 1, pivot: [118.5, -55.0, 60.7], axis: [0, 1, 0], polarity: 1 },
  { id: 2, pivot: [222.5, -55.0, 60.7], axis: [0, 1, 0], polarity: 1 },
  { id: 3, pivot: [296.5, -55.0, 60.7], axis: [0, 1, 0], polarity: -1 },
  // Joint 5 is the wrist roll: STEP-local +X follows the arm/tool axis.
  // With polarity -1, moving the slider left (negative angle) renders CCW roll.
  { id: 4, pivot: [362.75, -55.0, 59.7], axis: [1, 0, 0], polarity: -1 },
];

const CAD_COMPONENT_NAMES = [
  "Octagonal mount 1", "Octagonal mount 2", "Octagonal mount 3", "Main bearing",
  "Octagonal mount 3B", "Octagonal mount 2B", "Main servo horn", "Narrow U bracket / J1-J2",
  "J2 servo / ID 001", "Double U bracket / J2-J3", "J3 servo / ID 002", "Short C bracket / J3-J4",
  "J4 servo / ID 003", "Convex U bracket / J4-J5", "J5 servo / ID 004", "Aluminum gripper",
  "J6 servo / ID 005", "J1 servo / ID 000", "Base bolt", "Base bolt", "Base bolt", "Base bolt",
  "Jibot base plate",
];

const SERVO_COMPONENT_TO_ID = new Map([
  [17, 0], [8, 1], [10, 2], [12, 3], [14, 4], [16, 5],
]);

// The STEP importer groups each servo's output horn with its housing. Split
// them so each follows its physical mounting: J2/J4/J5 horns drive downstream
// links, while the J3 horn is fixed to the double U and its housing turns with
// the short C bracket.
const SERVO_OUTPUT_HORN_MESHES = new Map([
  [8, 10], [10, 14], [12, 18], [14, 22],
]);

const UPPER_JAW_MESHES = new Set([28, 31, 32, 39, 42]);
const LOWER_JAW_MESHES = new Set([27, 33, 34, 40, 41]);
// Calibrated against the recorded open pose (PWM 1200) and jaw-tip contact
// (PWM 1632, about 23.29 degrees); linkage travel continues to PWM 1700.
const GRIPPER_OPEN_PWM = 1200;
const GRIPPER_CONTACT_PWM = 1632;
// The STEP jaw tips meet at about 22 degrees per side; the old 39.1-degree
// pose pushed them through each other.
const GRIPPER_CLOSED_JAW_DEG = 22;

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let highlightedMesh = null;
let previousEmissive = null;

function updateRendererSize() {
  const rect = elements.canvasHost.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  renderer.setSize(rect.width, rect.height, false);
  camera.aspect = rect.width / rect.height;
  camera.updateProjectionMatrix();
  requestRender();
}

function fitCamera() {
  if (!cadAssembly) return;
  const bounds = new THREE.Box3().setFromObject(cadAssembly);
  const center = bounds.getCenter(new THREE.Vector3());
  const size = bounds.getSize(new THREE.Vector3());
  if (!modelCentered) {
    modelCenter.copy(center);
    cadAssembly.position.sub(modelCenter);
    grid.position.z = bounds.min.z - modelCenter.z;
    const basePivot = cadAssembly.userData.basePivot || CAD_JOINTS[0].pivot;
    const displayedBasePivot = new THREE.Vector3(...basePivot).applyEuler(cadAssembly.rotation).sub(modelCenter);
    axes.position.copy(displayedBasePivot);
    modelCentered = true;
  }
  modelRadius = Math.max(size.x, size.y, size.z) * 0.5 || 450;
  // Clear any orbit inertia before applying the user's saved view so Reset
  // returns to the same angle and framing even immediately after a drag.
  const dampingEnabled = controls.enableDamping;
  controls.enableDamping = false;
  controls.update();
  camera.position.fromArray(DEFAULT_CAMERA_VIEW.position);
  camera.up.fromArray(DEFAULT_CAMERA_VIEW.up);
  camera.fov = DEFAULT_CAMERA_VIEW.fov;
  camera.zoom = DEFAULT_CAMERA_VIEW.zoom;
  controls.target.fromArray(DEFAULT_CAMERA_VIEW.target);
  const distance = camera.position.distanceTo(controls.target);
  controls.minDistance = Math.min(Math.max(modelRadius * 0.45, 80), distance);
  controls.maxDistance = Math.max(modelRadius * 8, distance);
  camera.updateProjectionMatrix();
  controls.update();
  controls.saveState();
  controls.enableDamping = dampingEnabled;
  requestRender();
}

function makeCadMesh(sourceMesh) {
  const geometry = new THREE.BufferGeometry();
  const positions = sourceMesh.attributes?.position?.array;
  if (!positions?.length) return null;
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  const normals = sourceMesh.attributes?.normal?.array;
  if (normals?.length) geometry.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  if (sourceMesh.index?.array?.length) geometry.setIndex(Array.from(sourceMesh.index.array));
  if (!normals?.length) geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  geometry.name = sourceMesh.name || "Jibot component";

  const sourceColor = sourceMesh.color;
  const color = sourceColor?.length >= 3
    ? new THREE.Color(sourceColor[0], sourceColor[1], sourceColor[2])
    : new THREE.Color(0x9aa9bd);
  const material = new THREE.MeshStandardMaterial({
    color,
    metalness: 0.34,
    roughness: 0.52,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = sourceMesh.name || "Jibot component";
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  return mesh;
}

function makePivot(parent, pivotPosition, name) {
  const pivot = new THREE.Group();
  pivot.name = name;
  pivot.position.set(...pivotPosition);
  const content = new THREE.Group();
  content.position.set(-pivotPosition[0], -pivotPosition[1], -pivotPosition[2]);
  pivot.add(content);
  parent.add(pivot);
  return { pivot, content };
}

function attachComponent(parent, componentIndex, componentNodes, meshes) {
  const node = componentNodes[componentIndex];
  if (!node) throw new Error(`Missing STEP component ${componentIndex}`);
  const component = new THREE.Group();
  component.name = CAD_COMPONENT_NAMES[componentIndex] || node.name || `Component ${componentIndex}`;
  component.userData.componentIndex = componentIndex;
  const servoId = SERVO_COMPONENT_TO_ID.get(componentIndex);
  if (servoId !== undefined) component.userData.servoId = servoId;
  for (const meshIndex of node.meshes || []) {
    if (SERVO_OUTPUT_HORN_MESHES.get(componentIndex) === meshIndex) continue;
    const mesh = meshes.get(meshIndex);
    if (!mesh) continue;
    mesh.name = component.name;
    mesh.userData.componentIndex = componentIndex;
    if (servoId !== undefined) mesh.userData.servoId = servoId;
    component.add(mesh);
  }
  parent.add(component);
  return component;
}

function attachMeshIds(parent, meshIds, meshes, name, servoId = null) {
  const group = new THREE.Group();
  group.name = name;
  if (servoId !== null) group.userData.servoId = servoId;
  for (const meshId of meshIds) {
    const mesh = meshes.get(meshId);
    if (!mesh) continue;
    mesh.name = name;
    mesh.userData.componentName = name;
    if (servoId !== null) mesh.userData.servoId = servoId;
    group.add(mesh);
  }
  parent.add(group);
  return group;
}

function attachServoOutputHorn(parent, componentIndex, meshes) {
  const meshId = SERVO_OUTPUT_HORN_MESHES.get(componentIndex);
  const servoId = SERVO_COMPONENT_TO_ID.get(componentIndex);
  if (meshId === undefined || servoId === undefined) return;
  attachMeshIds(
    parent,
    [meshId],
    meshes,
    `J${servoId + 1} output horn / ID ${String(servoId).padStart(3, "0")}`,
    servoId,
  );
}

function setModelJointAngle(jointId, angleDeg) {
  if (!articulatedModelAvailable || !Number.isFinite(angleDeg)) return;
  modelJointAngles.set(jointId, angleDeg);
  const pivotData = modelJointPivots.get(jointId);
  if (!pivotData) {
    requestRender();
    return;
  }

  if (jointId === 5) {
    // The STEP jaws lie in the XY plane and hinge around local Z.
    const closedRatio = THREE.MathUtils.clamp(
      (angleToPwm(jointState.get(5), angleDeg) - GRIPPER_OPEN_PWM) / (GRIPPER_CONTACT_PWM - GRIPPER_OPEN_PWM),
      0,
      1,
    );
    const jawRadians = THREE.MathUtils.degToRad(closedRatio * GRIPPER_CLOSED_JAW_DEG);
    const jawAxis = new THREE.Vector3(0, 0, 1);
    pivotData.upper.quaternion.setFromAxisAngle(jawAxis, -jawRadians);
    pivotData.lower.quaternion.setFromAxisAngle(jawAxis, jawRadians);
    requestRender();
    return;
  }

  const { pivot, axis, polarity } = pivotData;
  pivot.quaternion.setFromAxisAngle(
    new THREE.Vector3(...axis),
    THREE.MathUtils.degToRad(angleDeg * polarity),
  );
  requestRender();
}

function animateModelJoint(jointId, targetAngle, durationMs = 1000, { fromAngle, elapsedMs = 0, linear = false } = {}) {
  if (!articulatedModelAvailable || !Number.isFinite(targetAngle)) return;
  modelAnimations.set(jointId, {
    from: Number.isFinite(fromAngle) ? fromAngle : modelJointAngles.get(jointId) || 0,
    to: targetAngle,
    startedAt: performance.now() - Math.max(0, elapsedMs),
    duration: Math.max(100, durationMs),
    linear,
  });
  requestRender();
}

function updateModelAnimations(now = performance.now()) {
  for (const [jointId, animation] of modelAnimations) {
    const progress = Math.min(1, (now - animation.startedAt) / animation.duration);
    const eased = animation.linear ? progress : progress * (2 - progress);
    setModelJointAngle(jointId, animation.from + (animation.to - animation.from) * eased);
    if (progress >= 1) modelAnimations.delete(jointId);
  }
}

function buildArticulatedAssembly(result) {
  const componentNodes = result.root?.children?.[0]?.children;
  if (!Array.isArray(componentNodes) || componentNodes.length !== CAD_COMPONENT_NAMES.length) {
    throw new Error("STEP assembly structure does not match the calibrated Jibot1 component map");
  }

  const meshes = new Map();
  result.meshes.forEach((sourceMesh, index) => {
    const mesh = makeCadMesh(sourceMesh);
    if (mesh) meshes.set(index, mesh);
  });

  const assembly = new THREE.Group();
  assembly.name = "Jibot1 articulated STEP assembly";

  // The servo ID 000 housing and the large base plate stay fixed.
  for (const componentIndex of [17, 18, 19, 20, 21, 22]) {
    attachComponent(assembly, componentIndex, componentNodes, meshes);
  }

  // Each nested pivot keeps the original STEP coordinates when the pose is zero.
  const axis1 = makePivot(assembly, CAD_JOINTS[0].pivot, "Joint 1 pivot / servo 000");
  for (let componentIndex = 0; componentIndex <= 8; componentIndex += 1) {
    attachComponent(axis1.content, componentIndex, componentNodes, meshes);
  }
  modelJointPivots.set(0, { pivot: axis1.pivot, axis: CAD_JOINTS[0].axis, polarity: CAD_JOINTS[0].polarity });

  // J2 moves the double U bracket between J2-J3 and the fixed J3 output horn.
  const axis2 = makePivot(axis1.content, CAD_JOINTS[1].pivot, "Joint 2 pivot / servo 001");
  attachComponent(axis2.content, 9, componentNodes, meshes);
  modelJointPivots.set(1, { pivot: axis2.pivot, axis: CAD_JOINTS[1].axis, polarity: CAD_JOINTS[1].polarity });
  attachServoOutputHorn(axis2.content, 8, meshes);
  attachServoOutputHorn(axis2.content, 10, meshes);

  // The J3 housing is fastened to the short C, so both turn together around
  // the J3 shaft fixed to the double U. Preserve their original STEP zero pose.
  // This carrier also holds the J4 housing and the complete wrist subtree.
  const axis3 = makePivot(axis2.content, CAD_JOINTS[2].pivot, "Joint 3 pivot / servo 002");
  for (const componentIndex of [10, 11, 12]) attachComponent(axis3.content, componentIndex, componentNodes, meshes);
  modelJointPivots.set(2, { pivot: axis3.pivot, axis: CAD_JOINTS[2].axis, polarity: CAD_JOINTS[2].polarity });

  // J4 moves the convex U bracket between J4-J5 and carries the J5 housing.
  const axis4 = makePivot(axis3.content, CAD_JOINTS[3].pivot, "Joint 4 pivot / servo 003");
  modelJointPivots.set(3, {
    pivot: axis4.pivot,
    axis: CAD_JOINTS[3].axis,
    polarity: CAD_JOINTS[3].polarity,
  });
  attachServoOutputHorn(axis4.content, 12, meshes);

  // Only the convex U and J5 housing are installed on the opposite side.
  // Turn that carrier around the line joining the J4 and J5 connection centers
  // so both centers stay fixed. Keep this mounting correction separate from
  // the J5 output/tool frame, which retains the original STEP reference.
  const wristMount = makePivot(axis4.content, CAD_JOINTS[3].pivot, "Convex U / J5 reversed mounting");
  const wristMountAxis = new THREE.Vector3(...CAD_JOINTS[4].pivot)
    .sub(new THREE.Vector3(...CAD_JOINTS[3].pivot))
    .normalize();
  wristMount.pivot.quaternion.setFromAxisAngle(wristMountAxis, Math.PI);
  for (const componentIndex of [13, 14]) attachComponent(wristMount.content, componentIndex, componentNodes, meshes);

  // The J5 output horn, complete gripper module and J6 retain their STEP
  // positions, orientations and joint axes. They follow live J4/J5 motion,
  // without inheriting the carrier's fixed mounting reversal.
  const axis5 = makePivot(axis4.content, CAD_JOINTS[4].pivot, "Joint 5 pivot / servo 004");
  const gripperNode = componentNodes[15];
  const gripperMeshIds = gripperNode.meshes || [];
  const jawMeshIds = new Set([...UPPER_JAW_MESHES, ...LOWER_JAW_MESHES]);
  attachMeshIds(axis5.content, gripperMeshIds.filter((meshId) => !jawMeshIds.has(meshId)), meshes, "Gripper housing and hardware");
  attachComponent(axis5.content, 16, componentNodes, meshes);
  modelJointPivots.set(4, { pivot: axis5.pivot, axis: CAD_JOINTS[4].axis, polarity: CAD_JOINTS[4].polarity });
  attachServoOutputHorn(axis5.content, 14, meshes);

  const upperJaw = makePivot(axis5.content, [410.0, -41.0, 54.2], "Gripper upper jaw hinge");
  attachMeshIds(upperJaw.content, [...UPPER_JAW_MESHES], meshes, "Upper gripper jaw", 5);
  const lowerJaw = makePivot(axis5.content, [410.0, -69.0, 54.2], "Gripper lower jaw hinge");
  attachMeshIds(lowerJaw.content, [...LOWER_JAW_MESHES], meshes, "Lower gripper jaw", 5);
  modelJointPivots.set(5, { upper: upperJaw.pivot, lower: lowerJaw.pivot });

  articulatedModelAvailable = true;
  assembly.userData.meshCount = meshes.size;
  for (const joint of jointState.values()) {
    const angle = Number.isFinite(joint.angle_deg) ? joint.angle_deg : 0;
    setModelJointAngle(joint.id, angle);
  }
  return assembly;
}

function finishModelLoading() {
  elements.modelLoading.classList.add("is-hidden");
  elements.modelLoading.classList.remove("is-unavailable");
  elements.modelLoaderRing.hidden = false;
  elements.modelSummary.classList.add("is-loaded");
  elements.modelModeLabel.textContent = controllerBackend === "mock" ? "SIMULATION" : "LIVE MODEL";
  elements.modelHeadingSubtitle.textContent = "/ Assembly view";
  elements.modelState.textContent = "Local STEP assembly loaded";
  if (calibration) updateReference(calibration);
  else updateModelNote();
  updateActionControls();
}

function setModelSourceChip(label) {
  const dot = document.createElement("span");
  dot.className = "chip-dot";
  elements.modelSourceChip.replaceChildren(dot, document.createTextNode(` ${label}`));
}

function beginStepLoading(detail) {
  modelLoadRevision += 1;
  if (activeStepWorker) {
    activeStepWorker.terminate();
    activeStepWorker = null;
  }
  modelDisplayMode = "loading";
  modelUnavailableMessage = "";
  elements.modelLoaderRing.hidden = false;
  elements.modelLoading.classList.remove("is-unavailable");
  elements.modelLoadingTitle.textContent = "Loading Jibot1 STEP model";
  elements.modelLoadingDetail.textContent = detail;
  elements.modelLoading.classList.remove("is-hidden");
  elements.modelModeLabel.textContent = "LOADING MODEL";
  elements.modelHeadingSubtitle.textContent = "/ Loading STEP assembly";
  elements.modelState.textContent = "Loading Jibot1 STEP model";
  elements.modelSummary.classList.remove("is-loaded");
  updateModelNote();
  return modelLoadRevision;
}

function invalidateStepLoading() {
  modelLoadRevision += 1;
  if (activeStepWorker) {
    activeStepWorker.terminate();
    activeStepWorker = null;
  }
}

function showModelUnavailable(message = STEP_UNAVAILABLE_MESSAGE, title = STEP_UNAVAILABLE_TITLE) {
  invalidateStepLoading();
  if (cadAssembly) scene.remove(cadAssembly);
  cadAssembly = null;
  modelJointPivots.clear();
  modelAnimations.clear();
  articulatedModelAvailable = false;
  modelCentered = false;
  modelDisplayMode = "unavailable";
  modelUnavailableMessage = message;
  elements.modelLoaderRing.hidden = true;
  elements.modelLoadingTitle.textContent = title;
  elements.modelLoadingDetail.textContent = message;
  elements.modelLoading.classList.add("is-unavailable");
  elements.modelLoading.classList.remove("is-hidden");
  elements.modelSummary.classList.remove("is-loaded");
  elements.modelModeLabel.textContent = "MODEL REQUIRED";
  elements.modelHeadingSubtitle.textContent = "/ STEP model unavailable";
  elements.modelState.textContent = "Jibot1 STEP model not loaded";
  elements.selectedPart.textContent = "No model loaded";
  setModelSourceChip("MODEL REQUIRED");
  if (calibration) updateReference(calibration);
  else updateModelNote();
  updateActionControls();
}

async function loadStepAssembly() {
  const revision = beginStepLoading("Checking for web/models/jibot1.step…");
  try {
    const response = await fetch("./models/jibot1.step");
    if (!response.ok) throw new Error(`STEP asset request failed (${response.status})`);
    const buffer = await response.arrayBuffer();
    if (revision !== modelLoadRevision) return;
    importStepBuffer(buffer, revision, STEP_PARSE_FAILED_MESSAGE, STEP_PARSE_FAILED_TITLE);
  } catch {
    if (revision === modelLoadRevision) showModelUnavailable();
  }
}

function importStepBuffer(buffer, revision, fallbackMessage, fallbackTitle) {
  if (revision !== modelLoadRevision) return;
  elements.modelLoadingDetail.textContent = "Preparing the articulated assembly…";
  let worker = null;
  try {
    worker = new Worker("./vendor/occt/dist/occt-import-js-worker.js");
    activeStepWorker = worker;
    const finishWorker = () => {
      worker.terminate();
      if (activeStepWorker === worker) activeStepWorker = null;
    };
    worker.onmessage = (event) => {
      finishWorker();
      if (revision !== modelLoadRevision) return;
      try {
        const result = event.data;
        if (!result?.success || !Array.isArray(result.meshes)) {
          throw new Error("OpenCascade could not read the STEP assembly");
        }
        modelJointPivots.clear();
        modelAnimations.clear();
        const assembly = buildArticulatedAssembly(result);
        // The source STEP uses its long arm direction as +X. First make it
        // upright, then apply a world-space 180° yaw to match the real arm's
        // left-facing reference orientation from the camera view.
        assembly.rotation.y = -Math.PI / 2;
        assembly.rotateOnWorldAxis(new THREE.Vector3(0, 0, 1), Math.PI);
        if (!assembly.children.length) throw new Error("The STEP file contains no renderable solids");
        if (cadAssembly) scene.remove(cadAssembly);
        cadAssembly = assembly;
        modelCentered = false;
        modelDisplayMode = "step";
        modelUnavailableMessage = "";
        setModelSourceChip("LOCAL STEP");
        scene.add(cadAssembly);
        fitCamera();
        finishModelLoading();
      } catch {
        showModelUnavailable(fallbackMessage, fallbackTitle);
      }
    };
    worker.onerror = () => {
      finishWorker();
      if (revision === modelLoadRevision) showModelUnavailable(fallbackMessage, fallbackTitle);
    };
    worker.onmessageerror = () => {
      finishWorker();
      if (revision === modelLoadRevision) showModelUnavailable(fallbackMessage, fallbackTitle);
    };
    const fileBuffer = new Uint8Array(buffer);
    worker.postMessage({
      format: "step",
      buffer: fileBuffer,
      params: {
        linearUnit: "millimeter",
        linearDeflectionType: "bounding_box_ratio",
        linearDeflection: 0.008,
        angularDeflection: 0.35,
      },
    }, [fileBuffer.buffer]);
  } catch {
    if (worker) worker.terminate();
    if (activeStepWorker === worker) activeStepWorker = null;
    if (revision === modelLoadRevision) showModelUnavailable(fallbackMessage, fallbackTitle);
  }
}

function loadModelView() {
  loadStepAssembly();
}

elements.resetCamera.addEventListener("click", fitCamera);
let viewportPointerOrigin = null;
let viewportDragged = false;
let viewportDragging = false;
let dragRenderScaleActive = false;

function lowerRenderScaleForDrag() {
  if (dragRenderScaleActive) return;
  dragRenderScaleActive = true;
  renderer.setPixelRatio(INTERACTION_RENDER_PIXEL_RATIO);
  requestRender();
}

function restoreRenderScaleAfterDrag(scheduleFrame = true) {
  if (!dragRenderScaleActive) return;
  dragRenderScaleActive = false;
  renderer.setPixelRatio(STATIC_RENDER_PIXEL_RATIO);
  if (scheduleFrame) requestRender();
}

renderer.domElement.addEventListener("pointerdown", (event) => {
  if (!event.isPrimary) {
    viewportDragged = true;
    return;
  }
  viewportPointerOrigin = { x: event.clientX, y: event.clientY };
  viewportDragged = false;
});
renderer.domElement.addEventListener("pointermove", (event) => {
  if (viewportPointerOrigin && !viewportDragged
    && Math.hypot(event.clientX - viewportPointerOrigin.x, event.clientY - viewportPointerOrigin.y) > 5) {
    viewportDragged = true;
    viewportDragging = true;
    lowerRenderScaleForDrag();
  }
});
renderer.domElement.addEventListener("pointerup", () => {
  viewportPointerOrigin = null;
  viewportDragging = false;
  requestRender();
});
renderer.domElement.addEventListener("pointercancel", () => {
  viewportPointerOrigin = null;
  viewportDragged = true;
  viewportDragging = false;
  requestRender();
});
renderer.domElement.addEventListener("click", (event) => {
  viewportPointerOrigin = null;
  if (event.button !== 0 || viewportDragged) return;
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const intersections = raycaster.intersectObjects(cadAssembly?.children || [], true);
  if (!intersections.length) {
    if (manualControlMode === "joint") closeManualPanel(false);
    return;
  }
  const mesh = intersections[0].object;
  if (highlightedMesh?.material?.emissive && previousEmissive) highlightedMesh.material.emissive.copy(previousEmissive);
  highlightedMesh = mesh;
  if (mesh.material?.emissive) {
    previousEmissive = mesh.material.emissive.clone();
    mesh.material.emissive.set(0x183a62);
  }
  requestRender();
  elements.selectedPart.textContent = mesh.name || "Selected model component";
  let node = mesh;
  while (node && !Number.isInteger(node.userData.servoId)) node = node.parent;
  if (node) {
    const servoId = Number(node.userData.servoId);
    const joint = jointState.get(servoId);
    openManualPanel("joint", servoId, event);
    elements.selectedPart.textContent = `SERVO ID ${String(servoId).padStart(3, "0")} · ${joint?.name || `Joint ${servoId + 1}`} control`;
  } else if (manualControlMode === "joint") {
    closeManualPanel(false);
  }
});

const MIN_RENDER_INTERVAL_MS = 1000 / 30;
const MIN_DRAG_RENDER_INTERVAL_MS = 1000 / 60;
let renderFrameRequest = 0;
let lastRenderedAt = 0;

function requestRender() {
  // Rendering is event-driven instead of a permanent animation loop so an
  // idle page does not keep consuming the board's GPU time.
  if (document.hidden || renderFrameRequest) return;
  renderFrameRequest = window.requestAnimationFrame(renderFrame);
}

function renderFrame(now) {
  renderFrameRequest = 0;
  if (document.hidden) return;
  const minRenderInterval = viewportDragging ? MIN_DRAG_RENDER_INTERVAL_MS : MIN_RENDER_INTERVAL_MS;
  if (lastRenderedAt && now - lastRenderedAt < minRenderInterval) {
    requestRender();
    return;
  }

  lastRenderedAt = now;
  // Continue scheduling frames only while a model animation or camera damping
  // is active; a completed pose returns to the low-cost idle state.
  updateModelAnimations(now);
  const cameraChanged = controls.update();
  if (!viewportDragging && !cameraChanged) restoreRenderScaleAfterDrag(false);
  renderer.render(scene, camera);
  if (modelAnimations.size || cameraChanged) requestRender();
}

controls.addEventListener("change", requestRender);
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    if (renderFrameRequest) window.cancelAnimationFrame(renderFrameRequest);
    renderFrameRequest = 0;
    viewportPointerOrigin = null;
    viewportDragging = false;
    restoreRenderScaleAfterDrag(false);
    return;
  }
  lastRenderedAt = 0;
  requestRender();
});

const resizeObserver = new ResizeObserver(updateRendererSize);
resizeObserver.observe(elements.canvasHost);
updateRendererSize();
requestRender();
loadModelView();
