const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createEdgeDock}=require('../edge-dock');
function fixture(area={x:0,y:0,width:1920,height:1080}){
  let bounds={x:300,y:100,width:280,height:640},destroyed=false,visible=true,blocked=false;
  const jobs=[],positions=[],changes=[];let mutations=0;
  const win={getBounds:()=>({...bounds}),setBounds:value=>{bounds={...value};mutations++;},setIgnoreMouseEvents:()=>{},isDestroyed:()=>destroyed,isVisible:()=>visible};
  const dock=createEdgeDock({getWindow:()=>win,getArea:()=>area,onChange:value=>changes.push(value),onPosition:value=>positions.push(value),canCollapse:()=>!blocked,schedule:fn=>{jobs.push(fn);return fn;},cancel:()=>{}});
  return {dock,jobs,positions,changes,bounds:()=>bounds,move:(x,y=100)=>{bounds={x,y,width:280,height:640};dock.noteMove(bounds);},destroy:()=>{destroyed=true;},block:value=>{blocked=value;},visible:value=>{visible=value;},mutations:()=>mutations};
}
test('左右边缘收起只保留小按钮，展开保持完整原位置并定时重新收起',()=>{
  for(const side of ['left','right']){const f=fixture();f.dock.beginDrag();f.move(side==='left'?5:1634);f.dock.finishDrag();assert.deepEqual(f.dock.read(),{side,collapsed:true});assert.deepEqual(f.bounds(),{x:side==='left'?0:1884,y:680,width:36,height:44});assert.deepEqual(f.positions.at(-1),[side==='left'?0:1640,100]);f.dock.expand();assert.deepEqual(f.bounds(),{x:side==='left'?0:1640,y:100,width:280,height:640});assert.equal(f.dock.read().collapsed,false);f.jobs.at(-1)();assert.equal(f.dock.read().collapsed,true);}
});
test('拖离边缘清除收起计时，旧回调不能收起新位置；普通位置不收起',()=>{const f=fixture();f.move(0);f.dock.finishDrag();f.dock.expand();const stale=f.jobs.at(-1);f.dock.beginDrag();f.move(400);f.dock.finishDrag();stale();assert.deepEqual(f.dock.read(),{side:null,collapsed:false});assert.equal(f.bounds().x,400);});
test('面板或提醒保持展开，捕获/不可见时延期；释放保持后重新计时',()=>{const f=fixture();f.move(0);f.dock.finishDrag();f.dock.expand();f.dock.hold(true);f.jobs.at(-1)();assert.equal(f.dock.read().collapsed,false);f.dock.hold(false);f.block(true);f.jobs.at(-1)();assert.equal(f.dock.read().collapsed,false);f.block(false);f.visible(false);f.jobs.at(-1)();assert.equal(f.dock.read().collapsed,false);f.visible(true);f.jobs.at(-1)();assert.equal(f.dock.read().collapsed,true);});
test('负坐标显示器与任务栏工作区可见，屏幕变化重算；销毁/停止后回调不操作窗口',()=>{const area={x:-1600,y:40,width:1600,height:900},f=fixture(area);f.move(-1600,2000);f.dock.finishDrag();assert.deepEqual(f.bounds(),{x:-1600,y:880,width:36,height:44});area.x=-1280;area.width=1280;f.dock.reflow();assert.equal(f.bounds().x,-1280);f.dock.expand();const late=f.jobs.at(-1),before=f.mutations();f.destroy();late();assert.equal(f.mutations(),before);f.dock.stop();f.dock.expand();f.dock.finishDrag();f.dock.reflow();assert.equal(f.mutations(),before);});
