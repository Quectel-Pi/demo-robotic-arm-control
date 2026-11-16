const LANGUAGE_STORAGE_KEY = "jibot-ui-language-v1";
const DEFAULT_LANGUAGE = "en";
const CHINESE_LANGUAGE = "zh-CN";

const CHINESE_TRANSLATIONS = Object.freeze({
  "Jibot Arm Studio": "Jibot 机械臂工作台",
  "SIX AXIS CONTROL": "六轴控制",
  "DISCONNECTED": "未连接",
  "Reconnect": "重新连接",
  "STOP": "停止",
  "SERVO BUS · 115200 BAUD": "舵机总线 · 115200 波特",
  "LIVE MODEL": "实时模型",
  "Assembly view": "装配视图",
  "REFERENCE · LOADING": "参考值 · 加载中",
  "Manual Control": "手动控制",
  "Reset camera view": "重置视角",
  "MANUAL CONTROL": "手动控制",
  "Joint positions": "关节位置",
  "DEG · PWM µs": "角度 · PWM µs",
  "Close manual controls": "关闭手动控制",
  "Close manual controls (Esc)": "关闭手动控制（Esc）",
  "Click a joint in the 3D model to open its control.": "点击 3D 模型中的关节以打开控制面板。",
  "Release the slider to move the selected joint.": "松开滑块后移动所选关节。",
  "Refresh state": "刷新状态",
  "Loading Jibot1 STEP model": "正在加载 Jibot1 STEP 模型",
  "SELECT A JOINT · DRAG TO ORBIT · SCROLL TO ZOOM": "选择关节 · 拖动旋转 · 滚轮缩放",
  "MODEL REQUIRED": "需要 STEP 模型",
  "LOADING MODEL": "正在加载模型",
  "REFERENCE": "参考视图",
  "Select a joint to control": "选择关节进行控制",
  "The 3D view requires a compatible Jibot1 STEP file at web/models/jibot1.step.": "3D 视图需要 web/models/jibot1.step 中的兼容 Jibot1 STEP 结构文件。",
  "CONTROLLER": "控制器",
  "Device status": "设备状态",
  "WAITING": "等待中",
  "ONLINE AXES": "在线轴数",
  "MOTION": "运动状态",
  "IDLE": "空闲",
  "LAST UPDATE": "最近更新",
  "Waiting for controller": "等待控制器",
  "Calibration": "校准",
  "Axis check": "轴检查",
  "Loading saved reference…": "正在加载已保存的参考值…",
  "Joint": "关节",
  "Angle": "角度",
  "Reference — · Readback —": "参考值 — · 回读 —",
  "Return to 0°": "返回 0°",
  "Saved direction checks": "已保存的方向检查",
  "+ Pending": "+ 待检查",
  "− Pending": "− 待检查",
  "Compare each real joint's movement direction with the 3D model.": "将实体关节的运动方向与 3D 模型进行比较。",
  "Matches 3D": "与 3D 一致",
  "✓ Matches 3D": "✓ 与 3D 一致",
  "Needs adjustment": "需要调整",
  "MOTION LIBRARY": "动作库",
  "Action groups": "动作组",
  "Offset adjustment": "偏差调整",
  "Curled pose": "蜷缩姿态",
  "Grasp pose": "抓取姿态",
  "Front pick": "前方抓取",
  "Left pick": "左侧抓取",
  "Right pick": "右侧抓取",
  "Front place": "前方放置",
  "Left place": "左侧放置",
  "Right place": "右侧放置",
  "Combined sequence": "组合序列",
  "Recorded action groups": "已录制动作组",
  "Loading groups…": "正在加载动作组…",
  "Action group name": "动作组名称",
  "Name this sequence": "为此序列命名",
  "Record": "录制",
  "Connect all six joints, then record poses from the current arm position.": "连接全部六个关节，然后根据机械臂当前位置录制姿态。",
  "Move joints, then capture each pose.": "移动关节，然后逐个捕获姿态。",
  "Move time": "运动时长",
  "Capture pose": "捕获姿态",
  "Discard": "放弃",
  "Save group": "保存动作组",
  "Loading saved action groups…": "正在加载已保存的动作组…",
  "Start group": "起始组",
  "End group": "结束组",
  "Repeat": "重复次数",
  "Playback target": "播放目标",
  "Selected range": "所选范围",
  "Demo sequence": "演示序列",
  "Run mode": "运行模式",
  "AUTO · OFFLINE PREVIEW": "自动 · 离线预览",
  "AUTO · ONLINE RUN": "自动 · 在线运行",
  "Offline preview": "离线预览",
  "Online run": "在线运行",
  "▶ Preview selected range": "▶ 预览所选范围",
  "Ranges run in order. The sequence is saved in this browser.": "各范围按顺序运行。序列保存在此浏览器中。",
  "Loading demo sequence…": "正在加载演示序列…",
  "Add selected range": "添加所选范围",
  "Clear": "清空",
  "Repeat applies to the selected playback target.": "重复次数应用于所选播放目标。",
  "Move step up": "上移步骤",
  "Move step down": "下移步骤",
  "Remove step": "移除步骤",
  "Calibrated zero": "已校准零位",
  "Unavailable": "不可用",
  "Servo values and timing": "舵机数值与时序",
  "PWM / ms · 6 AXES": "PWM / 毫秒 · 6 轴",
  "Recorded action group PWM and timing table": "已录制动作组 PWM 与时序表",
  "Group": "组",
  "Action": "动作",
  "Review": "检查",
  "TIME": "时长",
  "Loading recorded action groups…": "正在加载已录制的动作组…",
  "Select a row or set a group range to preview.": "选择一行或设置动作组范围以进行预览。",
  "Refresh library": "刷新动作库",
  "JIBOT1 · DEVELOPMENT CONSOLE": "JIBOT1 · 开发控制台",
  "Connect to the M2 controller to enable manual commands.": "连接 M2 控制器以启用手动命令。",
  "SERIAL VIA M2": "通过 M2 串口连接",
  "Switch to Chinese": "切换到中文",
  "Switch to English": "切换到英文",
  "3D robot model": "3D 机械臂模型",
  "Demo sequence ranges": "演示序列范围",
  "/ Assembly view": "/ 装配视图",
  "/ STEP model unavailable": "/ STEP 模型不可用",
  "/ Loading STEP assembly": "/ 正在加载 STEP 装配模型",
  "LOCAL STEP": "本地 STEP",

  "ZERO · SAVED BASELINE": "零位 · 已保存基准",
  "ZERO · NOMINAL REFERENCE": "零位 · 标称参考",
  "Baseline saved · angles are relative to the confirmed pose.": "基准已保存 · 角度以确认姿态为参考。",
  "Confirm and save a physical baseline before checking axes.": "检查轴之前，请先确认并保存实体基准姿态。",
  "Nominal reference: all six servos at 1500 µs (0°).": "标称参考：六个舵机均为 1500 µs（0°）。",
  "OFFLINE": "离线",
  "Pending": "待检查",
  "Saved in this browser.": "已保存到此浏览器。",
  "Recorded for this session.": "仅在本次会话中记录。",
  "Save a baseline before checking axes.": "检查轴之前请先保存基准姿态。",
  "Reconnect the controller to read the current pose.": "重新连接控制器以读取当前姿态。",
  "Wait for motion or preview to finish before marking a result.": "请等待运动或预览结束后再标记结果。",
  "Finish recording before checking an axis.": "完成录制后再检查轴。",
  "Wait for the 3D model to load.": "请等待 3D 模型加载完成。",
  "Record your comparison of the current live pose": "记录当前实时姿态的比较结果",
  "SIMULATION": "仿真",
  "MANUAL READY": "手动控制就绪",
  "CHECK LINK": "检查连接",
  "CONNECTED": "已连接",
  "LINK ERROR": "连接错误",
  "SERVO BUS": "舵机总线",
  "Controller connected · manual commands enabled": "控制器已连接 · 手动命令已启用",
  "Controller connected": "控制器已连接",
  "Stop command sent": "停止命令已发送",
  "Stop command sent to all managed servos": "已向所有受控舵机发送停止命令",
  "STOP SENT": "已发送停止命令",
  "MOVING": "运动中",
  "GROUP ACTIVE": "动作组运行中",
  "BUSY": "忙碌",
  "Connecting…": "正在连接…",
  "Recording started. Move the joints and capture each pose.": "录制已开始。移动关节并捕获各个姿态。",
  "Move the arm with the joint sliders, then capture each pose.": "使用关节滑块移动机械臂，然后捕获各个姿态。",
  "Start a recording, move joints, and capture each pose to build a sequence.": "开始录制，移动关节并捕获姿态，以创建动作序列。",
  "All six joints must be online before recording or playback.": "录制或播放前，六个关节必须全部在线。",
  "Connect all six joints to record or play action groups.": "连接全部六个关节以录制或播放动作组。",
  "No saved action groups yet.": "还没有已保存的动作组。",
  "Untitled action": "未命名动作",
  "Play": "播放",
  "Delete": "删除",
  "No ranges in the demo sequence. Add a selected range below.": "演示序列中还没有范围。请在下方添加所选范围。",
  "The demo sequence can contain up to 40 ranges.": "演示序列最多可包含 40 个范围。",
  "Library unavailable": "动作库不可用",
  "Groups unavailable": "动作组不可用",
  "Select this action's full group range": "选择此动作的完整动作组范围",
  "BLOCKED": "已阻止",
  "REVIEW": "待检查",
  "All six servos are online. Online run moves the real arm and requires the controller to be idle.": "六个舵机均已上线。在线运行会驱动实体机械臂，并要求控制器处于空闲状态。",
  "Simulation backend is active. Offline preview animates only the 3D model and sends no hardware commands.": "当前为仿真后端。离线预览只播放 3D 模型动画，不发送硬件指令。",
  "Controller state is unavailable. Offline preview animates only the 3D model; online run requires the controller and all six servos.": "暂时无法获取控制器状态。离线预览只播放 3D 模型动画；在线运行需要控制器和六个舵机全部上线。",
  "Fewer than six servos are online. Offline preview animates only the 3D model and sends no hardware commands.": "当前上线舵机少于六个。离线预览只播放 3D 模型动画，不发送硬件指令。",
  "Stop preview": "停止预览",
  "Running…": "运行中…",
  "▶ Run sequence online": "▶ 在线运行序列",
  "▶ Run range online": "▶ 在线运行范围",
  "▶ Preview sequence": "▶ 预览序列",
  "▶ Preview range": "▶ 预览范围",
  "Playback stopped.": "播放已停止。",
  "GROUP COMPLETE": "动作组完成",
  "PREPARING GROUP": "正在准备动作组",
  "3D SYNC INTERRUPTED": "3D 同步中断",
  "3D synchronization interrupted. Arm playback may still be active.": "3D 同步中断。机械臂可能仍在运行。",
  "All six servos are online; the mode has switched to online run.": "六个舵机均已上线，已自动切换为在线运行。",
  "Offline preview stopped.": "离线预览已停止。",
  "Online run requires a real controller connection.": "在线运行需要连接实体控制器。",
  "All six joints must be connected and idle before online playback.": "在线播放前，六个关节必须全部连接且处于空闲状态。",
  "PLAYING DEMO SEQUENCE": "正在播放演示序列",
  "PLAYING ACTION GROUPS": "正在播放动作组",
  "PLAYING GROUP": "正在播放动作组",
  "PLAYBACK STOPPED": "播放已停止",
  "PLAYBACK ERROR": "播放错误",
  "PLAYING": "播放中",
  "SEQUENCE COMPLETE": "序列完成",
  "GROUPS COMPLETE": "动作组已完成",
  "Action group playback stopped.": "动作组播放已停止。",
  "Demo sequence stopped.": "演示序列已停止。",
  "Demo sequence finished.": "演示序列已完成。",
  "Action groups finished.": "动作组已完成。",
  "Add at least one available range to the demo sequence.": "请至少向演示序列添加一个可用范围。",
  "The demo sequence contains an unavailable range. Remove it before running.": "演示序列包含不可用范围。请移除后再运行。",
  "Choose a valid demo sequence and repeat count (1–20).": "请选择有效的演示序列和重复次数（1–20）。",
  "Choose a valid group range and repeat count (1–20).": "请选择有效的动作组范围和重复次数（1–20）。",
  "Enter a name for this action group.": "请输入动作组名称。",
  "All six joints must be online and idle to record.": "录制前，六个关节必须全部在线且处于空闲状态。",
  "Current pose is unavailable until all six joints are online.": "六个关节全部在线后才能读取当前姿态。",
  "This pose matches the previous capture.": "此姿态与上一次捕获相同。",
  "Action group saved.": "动作组已保存。",
  "Action group deleted.": "动作组已删除。",
  "Playback stopped: joint did not reach its target.": "播放已停止：关节未到达目标位置。",
  "Gripper contact detected; position feedback may stop short of the target.": "检测到夹爪接触；位置反馈可能在到达目标前停止。",
  "Motion stopped because position error exceeded the limit.": "位置误差超出限制，运动已停止。",
  "Close manual controls": "关闭手动控制",
  "Show all six joint controls": "显示全部六个关节控制项",
  "Drag the slider to set a target. Release to move this joint.": "拖动滑块设置目标，松开后移动此关节。",
  "Select a joint below, or click a joint in the 3D model.": "在下方选择关节，或点击 3D 模型中的关节。",
  "OPEN": "打开",
  "CLOSE": "闭合",
  "Gripper open to close": "夹爪从打开到闭合",
  "CURRENT": "当前",
  "TARGET": "目标",
  "Contact detected · target not reached": "检测到接触 · 尚未到达目标",
  "Readback error": "回读错误",
  "Jibot1 STEP assembly loaded from web/models/jibot1.step.": "已从 web/models/jibot1.step 加载 Jibot1 STEP 装配模型。",
  "Loading Jibot1 STEP model from web/models/jibot1.step.": "正在从 web/models/jibot1.step 加载 Jibot1 STEP 模型。",
  "Place a compatible Jibot1 STEP file at web/models/jibot1.step, then reload the page.": "请将兼容的 Jibot1 STEP 文件放入 web/models/jibot1.step，然后重新加载页面。",
  "Check that web/models/jibot1.step is a compatible Jibot1 assembly.": "请确认 web/models/jibot1.step 是兼容的 Jibot1 装配结构文件。",
  "Jibot1 STEP model not found": "未找到 Jibot1 STEP 模型",
  "Jibot1 STEP model could not be loaded": "Jibot1 STEP 模型无法加载",
  "Jibot1 STEP model not loaded": "Jibot1 STEP 模型未加载",
  "No model loaded": "没有加载结构模型",
  "Jibot1 STEP assembly loaded": "Jibot1 STEP 装配模型已加载",
  "Local STEP assembly loaded": "本地 STEP 装配模型已加载",
  "Checking for web/models/jibot1.step…": "正在检查 web/models/jibot1.step…",
  "Preparing the articulated assembly…": "正在准备可动装配模型…",
  "Selected model component": "已选择模型部件",
});

const CHINESE_PATTERNS = [
  [/^(\d{1,2}:\d{2}:\d{2}) (AM|PM)$/, ([, time, half]) => `${half === "AM" ? "上午" : "下午"} ${time}`],
  [/^Saved reference: (.+)$/, ([, values]) => `已保存参考值：${values}`],
  [/^Servo ID (\d{3})$/, ([, id]) => `舵机 ID ${id}`],
  [/^SERVO BUS · (\d+) BAUD$/, ([, baud]) => `舵机总线 · ${baud} 波特`],
  [/^SIMULATION · (\d+) BAUD$/, ([, baud]) => `仿真模式 · ${baud} 波特`],
  [/^Offline preview (G\d{4}) · unfold elbow \/ wrist$/, ([, group]) => `离线预览 ${group} · 肘部 / 腕部展开`],
  [/^(Offset adjustment|Curled pose|Grasp pose|Front pick|Left pick|Right pick|Front place|Left place|Right place|Combined sequence) · (G\d{4}(?:–G\d{4})?)( · Unavailable)?$/, ([, action, range, unavailable]) => `${CHINESE_TRANSLATIONS[action]} · ${range}${unavailable ? " · 不可用" : ""}`],
  [/^Calibrated zero · (G\d{4})( · Unavailable)?$/, ([, range, unavailable]) => `已校准零位 · ${range}${unavailable ? " · 不可用" : ""}`],
  [/^Groups (G\d{4}(?:–G\d{4})?)( · Unavailable)?$/, ([, range, unavailable]) => `动作组 ${range}${unavailable ? " · 不可用" : ""}`],
  [/^(Move step up|Move step down|Remove step): (.+)$/, ([, action, range]) => `${CHINESE_TRANSLATIONS[action]}：${translatePhrase(range, CHINESE_LANGUAGE)}`],
  [/^Delete (.+)$/, ([, name]) => `删除 ${name}`],
  [/^(\d+) SAVED$/, ([, count]) => `已保存 ${count} 项`],
  [/^(\d+) GROUPS$/, ([, count]) => `${count} 组`],
  [/^(\d+) STEPS$/, ([, count]) => `${count} 步`],
  [/^(\d+) \/ 6 CHECKED$/, ([, count]) => `已检查 ${count} / 6`],
  [/^(\d+) POSES?$/, ([, count]) => `${count} 个姿态`],
  [/^RECORDING · (\d+) POSES$/, ([, count]) => `录制中 · ${count} 个姿态`],
  [/^Pose (\d+) · (.+) · ([\d.]+) s$/, ([, index, angles, seconds]) => `姿态 ${index} · ${angles} · ${seconds} 秒`],
  [/^J(\d+) control$/, ([, joint]) => `J${joint} 控制`],
  [/^J(\d+) target angle$/, ([, joint]) => `J${joint} 目标角度`],
  [/^SERVO ID (\d{3})$/, ([, id]) => `舵机 ID ${id}`],
  [/^Move only J(\d+) to ([+−-]?\d+°) from the saved reference$/, ([, joint, angle]) => `仅将 J${joint} 移动到已保存参考值的 ${angle}`],
  [/^Zero (.+) µs · Readback (.+)$/, ([, zero, readback]) => `零位 ${zero} µs · 回读 ${readback}`],
  [/^Target (.+)$/, ([, target]) => `目标 ${target}`],
  [/^J(\d+) ([+−-][\d.]+°): (.+)\. (Recorded for this session\.|Saved in this browser\.)$/, ([, joint, angle, result, saved]) => `J${joint} ${angle}：${result === "✓ Matches 3D" ? "与 3D 一致" : result === "Needs adjustment" ? "需要调整" : result}。${saved === "Recorded for this session." ? "仅在本次会话中记录。" : "已保存到此浏览器。"}`],
  [/^Compare J(\d+) at ([+−-]?[\d.]+°) with the real arm, then mark the result\.$/, ([, joint, angle]) => `将 J${joint} 的 ${angle} 与实体机械臂进行比较，然后标记结果。`],
  [/^J(\d+) position feedback is unavailable\. Refresh state, then compare the live pose\.$/, ([, joint]) => `J${joint} 的位置反馈不可用。请刷新状态后再比较实时姿态。`],
  [/^J(\d+) is near zero\. Move to ([+−-]\d+°) or ([+−-]\d+°) before marking a direction\.$/, ([, joint, positive, negative]) => `J${joint} 接近零位。请先移动到 ${positive} 或 ${negative}，再标记方向。`],
  [/^Move only J(\d+) to ([+−-]\d+°) from the saved reference$/, ([, joint, angle]) => `仅将 J${joint} 移动到已保存参考值的 ${angle}`],
  [/^Playing (.+)$/, ([, name]) => `正在执行 ${name}`],
  [/^Finished (.+)$/, ([, name]) => `已完成 ${name}`],
  [/^Delete "(.+)"\?$/, ([, name]) => `确定删除“${name}”吗？`],
  [/^STAGE (\d+)\/(\d+) · (.+)$/, ([, current, total, phase]) => `阶段 ${current}/${total} · ${phase === "READBACK" ? "回读" : phase}`],
  [/^STAGE (\d+)\/(\d+) COMPLETE$/, ([, current, total]) => `阶段 ${current}/${total} 已完成`],
  [/^J(\d+) MOVING$/, ([, joint]) => `J${joint} 运动中`],
  [/^J(\d+) ACTIVE$/, ([, joint]) => `J${joint} 运行中`],
  [/^Sequence · Offline preview (G\d{4}) · unfold elbow \/ wrist$/, ([, group]) => `序列 · 离线预览 ${group} · 肘部 / 腕部展开`],
  [/^(Sequence · )?Offline preview (G\d{4}) · (\d+)\/(\d+)$/, ([, sequence, group, current, total]) => `${sequence ? "序列 · " : ""}离线预览 ${group} · ${current}/${total}`],
  [/^Previewed demo sequence: (\d+) groups × (\d+)\. Hardware was not moved\.$/, ([, groups, repeat]) => `已预览演示序列：${groups} 组 × ${repeat} 次。机械臂未移动。`],
  [/^Previewed (\d+) groups × (\d+)\. Hardware was not moved\.$/, ([, groups, repeat]) => `已预览 ${groups} 组 × ${repeat} 次。机械臂未移动。`],
  [/^Blocked before motion: (.+)$/, ([, groups]) => `运动前已阻止：${groups}`],
  [/^Selected range contains blocked groups: (.+)\. No motion was started\.$/, ([, groups]) => `所选范围包含已阻止的动作组：${groups}。未启动运动。`],
  [/^Sequence (\d+)\/(\d+) · (G\d{4}) · (\d+)\/(\d+)$/, ([, index, total, group, repeat, repeats]) => `序列 ${index}/${total} · ${group} · ${repeat}/${repeats}`],
  [/^Online run (G\d{4}) · (\d+)\/(\d+)$/, ([, group, repeat, repeats]) => `在线运行 ${group} · ${repeat}/${repeats}`],
  [/^Sequence stopped after (\d+) group\(s\)\.$/, ([, count]) => `序列已停止，已完成 ${count} 组。`],
  [/^Online playback stopped after (\d+) group\(s\)\.$/, ([, count]) => `在线播放已停止，已完成 ${count} 组。`],
  [/^Demo sequence finished (\d+) group\(s\)\.$/, ([, count]) => `演示序列已完成 ${count} 组。`],
  [/^Finished (\d+) group\(s\)\.$/, ([, count]) => `已完成 ${count} 组。`],
  [/^Finished (\d+) action group\(s\)$/, ([, count]) => `已完成 ${count} 个动作组`],
  [/^Playback stopped: joint (\d+) did not reach its target\.$/, ([, joint]) => `播放已停止：关节 ${joint} 未到达目标位置。`],
  [/^J(\d+) command complete · target ([+−-]?[\d.]+°)$/, ([, joint, angle]) => `J${joint} 命令完成 · 目标 ${angle}`],
  [/^Contact detected · target not reached$/, () => "检测到接触 · 尚未到达目标"],
  [/^Controller returned (\d+)$/, ([, status]) => `控制器返回 ${status}`],
  [/^ID (\d+) PWM (\d+) exceeds the configured soft limits$/, ([, id, pwm]) => `ID ${id} 的 PWM ${pwm} 超出已配置的软限位`],
  [/^J6 PWM (\d+) exceeds the confirmed gripper close limit$/, ([, pwm]) => `J6 的 PWM ${pwm} 超出已确认的夹爪闭合限位`],
  [/^Select group (G\d{4})$/, ([, group]) => `选择动作组 ${group}`],
];

const textStates = new WeakMap();
const attributeStates = new WeakMap();

function translatePhrase(source, language) {
  if (language !== CHINESE_LANGUAGE) return source;
  if (Object.hasOwn(CHINESE_TRANSLATIONS, source)) return CHINESE_TRANSLATIONS[source];
  for (const [pattern, render] of CHINESE_PATTERNS) {
    const match = source.match(pattern);
    if (match) return render(match);
  }
  return source;
}

function translatePreservingWhitespace(source, language) {
  const match = source.match(/^(\s*)([\s\S]*?)(\s*)$/);
  if (!match) return translatePhrase(source, language);
  return `${match[1]}${translatePhrase(match[2], language)}${match[3]}`;
}

function sourceTextForNode(node) {
  const current = node.nodeValue || "";
  const state = textStates.get(node);
  return state && state.output === current ? state.source : current;
}

function localizeTextNode(node, language) {
  if (node.parentElement?.closest("[data-i18n-ignore]")) return;
  const source = sourceTextForNode(node);
  const output = translatePreservingWhitespace(source, language);
  textStates.set(node, { source, output });
  if (node.nodeValue !== output) node.nodeValue = output;
}

function sourceTextForElement(element) {
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  const parts = [];
  while (walker.nextNode()) parts.push(sourceTextForNode(walker.currentNode));
  return parts.join("");
}

function localizeAttribute(element, attribute, language) {
  const current = element.getAttribute(attribute);
  if (current === null) return;
  let states = attributeStates.get(element);
  if (!states) {
    states = new Map();
    attributeStates.set(element, states);
  }
  const state = states.get(attribute);
  const source = state && state.output === current ? state.source : current;
  const output = translatePhrase(source, language);
  states.set(attribute, { source, output });
  if (current !== output) element.setAttribute(attribute, output);
}

function localizeElementAttributes(element, language) {
  if (element.closest("[data-i18n-ignore]")) return;
  for (const attribute of ["title", "aria-label", "placeholder"]) {
    localizeAttribute(element, attribute, language);
  }
}

function scanNode(node, language) {
  if (node.nodeType === Node.TEXT_NODE) {
    localizeTextNode(node, language);
    return;
  }
  if (node.nodeType === Node.ELEMENT_NODE) localizeElementAttributes(node, language);
  const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) localizeTextNode(walker.currentNode, language);
  if (node.querySelectorAll) {
    for (const element of node.querySelectorAll("*")) localizeElementAttributes(element, language);
  }
}

export function initializeLocalization() {
  const toggle = document.getElementById("language-toggle");
  let language = DEFAULT_LANGUAGE;
  try {
    if (window.localStorage.getItem(LANGUAGE_STORAGE_KEY) === CHINESE_LANGUAGE) {
      language = CHINESE_LANGUAGE;
    }
  } catch {
    // Keep English as the default when browser storage is unavailable.
  }

  const pageTitleSource = document.title;
  const applyLanguage = () => {
    document.documentElement.lang = language;
    document.title = translatePhrase(pageTitleSource, language);
    scanNode(document.body, language);
    if (toggle) {
      toggle.textContent = language === DEFAULT_LANGUAGE ? "中" : "EN";
      const label = language === DEFAULT_LANGUAGE ? "Switch to Chinese" : "Switch to English";
      toggle.setAttribute("aria-label", label);
      toggle.title = label;
      toggle.setAttribute("aria-pressed", String(language === CHINESE_LANGUAGE));
    }
  };

  const observer = new MutationObserver((records) => {
    for (const record of records) {
      if (record.type === "characterData") {
        localizeTextNode(record.target, language);
      } else if (record.type === "attributes") {
        localizeAttribute(record.target, record.attributeName, language);
      } else {
        for (const node of record.addedNodes) scanNode(node, language);
      }
    }
  });
  observer.observe(document.body, {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
    attributeFilter: ["title", "aria-label", "placeholder"],
  });

  if (toggle) {
    toggle.addEventListener("click", () => {
      language = language === DEFAULT_LANGUAGE ? CHINESE_LANGUAGE : DEFAULT_LANGUAGE;
      try {
        window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
      } catch {
        // The selected language still applies for this page session.
      }
      applyLanguage();
    });
  }
  applyLanguage();

  return {
    getSourceText: sourceTextForElement,
    translate: (source) => translatePhrase(source, language),
  };
}
