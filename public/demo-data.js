import { randomUUID } from 'node:crypto';
import { localDay, normalizeTask, periodBounds, validateTask } from './task-model.js';
import { validateTimeState } from './time-model.js';

// Synthetic, deterministic schedule relative to the viewing day. No personal records are copied.
export function createDemoState(now = new Date()) {
  now = new Date(now);
  const today = localDay(now), first = new Date(today + 'T12:00:00');
  first.setDate(first.getDate() - 35);
  const state = { generation: randomUUID(), demo: true, demoAnchorDate: today,
    categories: ['工作','学习','生活'], subtypes: [
      {category:'工作',name:'项目开发'},{category:'工作',name:'沟通协作'},
      {category:'学习',name:'阅读'},{category:'学习',name:'技能提升'},
      {category:'生活',name:'运动'},{category:'生活',name:'整理'}], tasks: [], reviews: [] };
  const create = (id,title,category,subtype,kind='task',date=localDay(first)) => {
    const task = normalizeTask({id:'demo-'+id,title:'[演示] '+title,category,subtype,kind,date,
      started:date,progress:0,minutes:0,done:null});
    state.tasks.push(task);return task;
  };
  const add = (task,date,start,end,source='timer') => {
    const a=new Date(date+'T'+start), b=new Date(date+'T'+end);
    if(b>now)return false;
    task.sessions.push({id:task.id+'-'+date+'-'+start,start:a.toISOString(),end:b.toISOString(),source});return true;
  };
  const finish = (task,date) => { task.done=date;task.status='completed';task.progress=100;task.previousProgress=65; };
  const project=create('project','个人项目开发','工作','项目开发');project.progress=72;
  const reading=create('reading','阅读与知识整理','学习','阅读');reading.progress=85;
  const learning=create('learning','TypeScript 实践课程','学习','技能提升');learning.progress=48;
  const home=create('home','书桌与资料整理','生活','整理');home.progress=35;
  const waiting=create('waiting','设计稿确认','工作','沟通协作');waiting.progress=40;
  const weeks=new Set(), months=new Set();
  let index=0;
  for(const d=new Date(first);localDay(d)<=today;d.setDate(d.getDate()+1),index++) {
    const date=localDay(d),weekday=d.getDay();
    weeks.add(periodBounds('week',date)[0]);months.add(date.slice(0,7));
    const run=create('run-'+date,'晨间跑步','生活','运动','habit',date);
    if(add(run,date,'07:10:00','07:40:00',index%2?'timer':'manual'))finish(run,date);
    else state.tasks.splice(state.tasks.indexOf(run),1);
    if(weekday!==0&&weekday!==6) {
      add(project,date,index%3?'09:00:00':'09:20:00',index%3?'10:30:00':'10:50:00');
      if(weekday===2) {
        const meeting=create('meeting-'+date,'需求评审与沟通','工作','沟通协作','task',date);
        if(add(meeting,date,'16:00:00','16:40:00','manual'))finish(meeting,date);
        else state.tasks.splice(state.tasks.indexOf(meeting),1);
      }
      if(weekday===5 && date<today) {
        const release=create('release-'+date,'发布阶段版本','工作','项目开发','task',date);
        if(add(release,date,'13:00:00','13:50:00')) {
          finish(release,date);release.milestone=true;release.milestoneNote='演示里程碑：完成一次完整交付，记录阶段成果。';
        }
      }
      if(index%2===0)add(learning,date,'14:10:00','15:25:00');
    } else add(home,date,'17:00:00','17:45:00','manual');
    add(reading,date,'11:00:00',weekday===0?'12:00:00':'11:40:00',index%3?'timer':'manual');
  }
  const yesterday=new Date(today+'T12:00:00');yesterday.setDate(yesterday.getDate()-1);
  const pausedDate=localDay(yesterday);
  add(waiting,pausedDate,'18:00:00','18:20:00','manual');
  waiting.status='interrupted';waiting.interruptions=[{at:new Date(pausedDate+'T18:30:00').toISOString(),
    reason:'演示中断：等待设计反馈，保留当前进度，确认后恢复。',resumedAt:null}];
  // Even a very early visit has a small, non-future sample for today's pie.
  if(!state.tasks.some(t=>t.sessions.some(s=>localDay(s.start)===today))) {
    const start=new Date(today+'T00:00:00').getTime(),elapsed=now.getTime()-start;
    if(elapsed>4000) {
      const sample=create('early','今日专注示例','工作','项目开发','task',today);
      for(let i=0;i<2;i++)sample.sessions.push({id:'demo-early-'+i,start:new Date(start+elapsed*(.1+i*.35)).toISOString(),
        end:new Date(start+elapsed*(.3+i*.35)).toISOString(),source:i?'timer':'manual'});
      sample.progress=30;
    }
  }
  const colors=['#65745d','#d3904c','#aa6788','#5179b1'];
  [...weeks].sort().forEach((date,i)=>state.reviews.push({id:'demo-week-'+date,kind:'week',date,
    key:i===1||i===3,color:colors[i%colors.length],
    text:'[演示复盘]\n\n本周的收获：上午保持连续专注，完成项目推进与阅读。\n\n需要调整：下午学习时段偶有分散，下周先列出单次学习目标。\n\n下一步：保留晨间运动，在周五留出交付和回顾时间。'}));
  [...months].sort().forEach(date=>state.reviews.push({id:'demo-month-'+date,kind:'month',date:date+'-01',key:false,color:colors[0],
    text:'[演示月复盘]\n\n本月持续投入项目开发、技能学习与运动。结合上方文字统计，比较上午与下午的投入分布。\n\n下月计划：减少任务切换，给每周安排明确的交付节点。'}));
  for(const year of new Set([...months].map(m=>m.slice(0,4)))) state.reviews.push({id:'demo-year-'+year,kind:'year',date:year+'-01-01',key:false,color:colors[0],
    text:'[演示年复盘]\n\n年度主题：持续积累，按月复盘，关注实际成果。通过月份链接回看具体记录。'});
  state.tasks=state.tasks.map(t=>validateTask(normalizeTask(t)));
  validateTimeState(state.tasks,now);
  return state;
}
