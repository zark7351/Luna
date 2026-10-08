const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createEdgeDock,clampHorizontal}=require('../edge-dock');
const {TOOLBAR_INSET,TOOLBAR_WIDTH}=require('../core');
function fixture(area={x:0,y:0,width:1920,height:1080},inset=0,height=640){
  let bounds={x:300,y:100,width:280,height},destroyed=false,visible=true,blocked=false;
  const jobs=[],positions=[],changes=[];let mutations=0;
  const win={getBounds:()=>({...bounds}),setBounds:value=>{bounds={...value};mutations++;},setIgnoreMouseEvents:()=>{},isDestroyed:()=>destroyed,isVisible:()=>visible};
  const dock=createEdgeDock({getWindow:()=>win,getArea:()=>area,getInset:()=>inset,getHeight:()=>height,onChange:value=>changes.push(value),onPosition:value=>positions.push(value),canCollapse:()=>!blocked,schedule:fn=>{jobs.push(fn);return fn;},cancel:()=>{}});
  return {dock,jobs,positions,changes,bounds:()=>bounds,move:(x,y=100)=>{bounds={x,y,width:280,height};dock.noteMove(bounds);},inset:value=>{inset=value;dock.reflow();},height:value=>{height=value;dock.reflow();},destroy:()=>{destroyed=true;},block:value=>{blocked=value;},visible:value=>{visible=value;},mutations:()=>mutations};
}
test('左右边缘收起只保留小按钮，展开保持完整原位置并定时重新收起',()=>{
  for(const side of ['left','right']){const f=fixture();f.dock.beginDrag();f.move(side==='left'?5:1634);f.dock.finishDrag();assert.deepEqual(f.dock.read(),{side,collapsed:true});assert.deepEqual(f.bounds(),{x:side==='left'?0:1884,y:680,width:36,height:44});assert.deepEqual(f.positions.at(-1),[side==='left'?0:1640,100]);f.dock.expand();assert.deepEqual(f.bounds(),{x:side==='left'?0:1640,y:100,width:280,height:640});assert.equal(f.dock.read().collapsed,false);f.jobs.at(-1)();assert.equal(f.dock.read().collapsed,true);}
});
test('拖离边缘清除收起计时，旧回调不能收起新位置；普通位置不收起',()=>{const f=fixture();f.move(0);f.dock.finishDrag();f.dock.expand();const stale=f.jobs.at(-1);f.dock.beginDrag();f.move(400);f.dock.finishDrag();stale();assert.deepEqual(f.dock.read(),{side:null,collapsed:false});assert.equal(f.bounds().x,400);});
test('面板或提醒保持展开，捕获/不可见时延期；释放保持后重新计时',()=>{const f=fixture();f.move(0);f.dock.finishDrag();f.dock.expand();f.dock.hold(true);f.jobs.at(-1)();assert.equal(f.dock.read().collapsed,false);f.dock.hold(false);f.block(true);f.jobs.at(-1)();assert.equal(f.dock.read().collapsed,false);f.block(false);f.visible(false);f.jobs.at(-1)();assert.equal(f.dock.read().collapsed,false);f.visible(true);f.jobs.at(-1)();assert.equal(f.dock.read().collapsed,true);});
test('负坐标显示器与任务栏工作区可见，屏幕变化重算；销毁/停止后回调不操作窗口',()=>{const area={x:-1600,y:40,width:1600,height:900},f=fixture(area);f.move(-1600,2000);f.dock.finishDrag();assert.deepEqual(f.bounds(),{x:-1600,y:880,width:36,height:44});area.x=-1280;area.width=1280;f.dock.reflow();assert.equal(f.bounds().x,-1280);f.dock.expand();const late=f.jobs.at(-1),before=f.mutations();f.destroy();late();assert.equal(f.mutations(),before);f.dock.stop();f.dock.expand();f.dock.finishDrag();f.dock.reflow();assert.equal(f.mutations(),before);});

test('白条可见边缘决定拖动限制及贴边，透明窗口边缘不提前触发',()=>{
  const area={x:-1600,y:40,width:1600,height:900};
  assert.equal(clampHorizontal(-9999,area,280,TOOLBAR_INSET),area.x-TOOLBAR_INSET);
  assert.equal(clampHorizontal(9999,area,280,TOOLBAR_INSET),-280+TOOLBAR_INSET);
  for(const side of ['left','right']){
    const f=fixture(area,TOOLBAR_INSET),edge=side==='left'?area.x-TOOLBAR_INSET:-280+TOOLBAR_INSET;
    f.move(side==='left'?area.x:-280);f.dock.finishDrag();assert.equal(f.dock.read().side,null);
    f.move(edge+(side==='left'?13:-13));f.dock.finishDrag();assert.equal(f.dock.read().side,null);
    f.move(edge+(side==='left'?12:-12));f.dock.finishDrag();assert.deepEqual(f.dock.read(),{side,collapsed:true});
    f.dock.expand();assert.equal(f.bounds().x,edge);assert.equal(f.positions.at(-1)[0],edge);
    const visibleEdge=side==='left'?f.bounds().x+TOOLBAR_INSET:f.bounds().x+TOOLBAR_INSET+TOOLBAR_WIDTH;
    assert.equal(visibleEdge,side==='left'?area.x:0);
    f.dock.hold(true);f.inset(0);assert.equal(f.bounds().x,side==='left'?area.x:-280);assert.equal(f.dock.read().collapsed,false);
    f.inset(TOOLBAR_INSET);assert.equal(f.bounds().x,edge);f.dock.hold(false);f.jobs.at(-1)();assert.equal(f.dock.read().collapsed,true);
  }
});

test('纯净工具条收起/展开保留紧凑高度，面板期间使用展开高度',()=>{
  for(const side of ['left','right']){
    const f=fixture(undefined,TOOLBAR_INSET,128),x=side==='left'?-TOOLBAR_INSET:1920-280+TOOLBAR_INSET;
    f.move(x,300);f.dock.finishDrag();assert.equal(f.bounds().height,44);assert.equal(f.bounds().y,368);
    f.dock.expand();assert.deepEqual(f.bounds(),{x,y:300,width:280,height:128});
    f.dock.hold(true);f.height(640);assert.equal(f.bounds().height,640);assert.equal(f.dock.read().collapsed,false);
    f.height(128);f.dock.hold(false);f.jobs.at(-1)();assert.equal(f.bounds().height,44);
    f.dock.beginDrag();f.move(600,300);f.dock.finishDrag();assert.deepEqual(f.dock.read(),{side:null,collapsed:false});assert.equal(f.bounds().height,128);
  }
});
