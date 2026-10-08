const test=require('node:test'),assert=require('node:assert/strict');
const {clamp,drag,toolbar}=require('../recording-frame-geometry');
test('all eight resize directions keep the opposite side fixed and stay inside the display',()=>{
  const rect={x:100,y:80,width:200,height:120},bounds={width:800,height:600};
  for(const edge of ['n','s','e','w','nw','ne','sw','se']){
    const next=drag(rect,edge,20,10,bounds);
    if(!edge.includes('w'))assert.equal(next.x,rect.x);else assert.equal(next.x+next.width,300);
    if(!edge.includes('n'))assert.equal(next.y,rect.y);else assert.equal(next.y+next.height,200);
    assert.ok(next.width>=32&&next.height>=32);
  }
  assert.deepEqual(drag(rect,'move',-1000,1000,bounds),{x:0,y:480,width:200,height:120});
  assert.equal(drag(rect,'nw',1000,1000,bounds).width,32);assert.equal(drag(rect,'se',1000,1000,bounds).width,700);
  assert.throws(()=>clamp({x:NaN,y:0,width:100,height:100},bounds));
});
test('toolbar stays outside above the frame and moves inside at screen edges, including tiny regions',()=>{
  const bounds={width:1920,height:1080};
  assert.equal(toolbar({x:100,y:200,width:300,height:200},bounds).inside,false);
  for(const rect of [{x:0,y:0,width:1920,height:1080},{x:1888,y:1048,width:32,height:32},{x:0,y:0,width:32,height:32}]){
    const bar=toolbar(rect,bounds);assert.ok(bar.x>=0&&bar.y>=0&&bar.x+bar.width<=1920&&bar.y+bar.height<=1080);
  }
  assert.equal(toolbar({x:0,y:0,width:400,height:200},bounds).inside,true);
});
