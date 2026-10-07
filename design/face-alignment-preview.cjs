// Isolated visual contact sheets of the actual character renderer; never reads pet data.
const {app,BrowserWindow,nativeImage}=require('electron');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
app.setPath('userData',fs.mkdtempSync(path.join(os.tmpdir(),'luna-face-alignment-')));
app.whenReady().then(async()=>{
  const win=new BrowserWindow({show:false,webPreferences:{sandbox:true,contextIsolation:true}});
  try{
    await win.loadFile(path.join(__dirname,'face-alignment-preview.html'));
    const results=await win.webContents.executeJavaScript(`(async()=>{
      const sheets=[],names=['neutral','closed','happy','wink','smile','shy','angry','pout'];
      const pet=document.querySelector('#preview-pet'),controller=createLunaCharacter(pet);
      for(const hair of ['original','straight','bob','twintails']){
        const sheet=document.createElement('canvas');sheet.width=names.length*240;sheet.height=4*260;
        const ctx=sheet.getContext('2d');ctx.fillStyle='#fffafd';ctx.fillRect(0,0,sheet.width,sheet.height);
        for(const [row,outfit]of ['original','jk','secretary','nurse'].entries()){
          await controller.setLook(hair,outfit);const look=lunaCharacterAssets.getLook(hair,outfit),body=new Image();body.src='assets/'+look.body.file;await body.decode();
          const base=document.createElement('canvas');base.width=512;base.height=1024;const paint=base.getContext('2d');
          for(const [column,expression]of names.entries()){
            pet.classList.remove('blink');controller.cancel();if(expression==='closed')pet.classList.add('blink');else if(expression!=='neutral')controller.react(expression);controller.draw();
            paint.clearRect(0,0,512,1024);paint.drawImage(body,0,0,512,1024,0,0,512,1024);paint.drawImage(pet.querySelector('canvas'),0,0);
            const center=(look.face.eyes[0][0]+look.face.eyes[1][0])/2,top=Math.min(...look.face.eyes.map(p=>p[1]))-42;
            ctx.drawImage(base,center-60,top,120,115,column*240,row*260+25,240,230);
            ctx.fillStyle='#685471';ctx.font='16px Segoe UI';ctx.fillText(hair+' / '+outfit+' / '+expression,column*240+5,row*260+19);
          }
        }
        sheets.push({name:hair,data:sheet.toDataURL()});
      }
      for(const hair of ['original','straight','bob','twintails']){
        const sheet=document.createElement('canvas');sheet.width=2240;sheet.height=480;const ctx=sheet.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,sheet.width,sheet.height);
        for(const [column,outfit]of ['original','jk','secretary','nurse'].entries()){
          const look=lunaCharacterAssets.getLook(hair,outfit),body=new Image();body.src='assets/'+look.body.file;await body.decode();const left=170,top=65,scale=4;
          ctx.drawImage(body,left,top,140,115,column*560,20,560,460);ctx.font='14px Segoe UI';ctx.fillStyle='#444';ctx.fillText(hair+' / '+outfit,column*560+4,15);
          for(let x=180;x<=300;x+=10){ctx.strokeStyle='#a89ca077';ctx.beginPath();ctx.moveTo(column*560+(x-left)*scale,20);ctx.lineTo(column*560+(x-left)*scale,480);ctx.stroke();ctx.fillStyle='#556';ctx.fillText(x,column*560+(x-left)*scale+2,40);}
          for(let y=80;y<=170;y+=10){ctx.strokeStyle='#a89ca077';ctx.beginPath();ctx.moveTo(column*560,20+(y-top)*scale);ctx.lineTo((column+1)*560,20+(y-top)*scale);ctx.stroke();ctx.fillStyle='#556';ctx.fillText(y,column*560+3,20+(y-top)*scale);}
          for(const p of [...look.face.eyes,look.face.mouth]){ctx.strokeStyle='#e30054';ctx.beginPath();ctx.arc(column*560+(p[0]-left)*scale,20+(p[1]-top)*scale,5,0,Math.PI*2);ctx.stroke();}
        }
        sheets.push({name:'anchors-'+hair,data:sheet.toDataURL()});
      }
      for(const [key,pack]of Object.entries(lunaCharacterAssets.facePacks)){
        const body=new Image();body.src='assets/'+pack.file;await body.decode();const sheet=document.createElement('canvas');sheet.width=1680;sheet.height=540;const ctx=sheet.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,1680,540);
        for(let frame=0;frame<3;frame++){const center=frame===0?lunaCharacterAssets.looks[{'silver-dress':'original-original','silver-jk':'original-jk','black-dress':'straight-original','black-jk':'straight-jk'}[key]].face:pack;
          ctx.drawImage(body,frame*512+170,60,140,130,frame*560,20,560,520);
          const points=frame===0?[...center.eyes,center.mouth]:frame===1?center.closed:[...center.happy,center.smile];
          ctx.font='14px Segoe UI';ctx.fillStyle='#444';ctx.fillText(key+' frame '+frame,frame*560+4,15);
          for(let x=180;x<=300;x+=10){ctx.strokeStyle='#a89ca077';ctx.beginPath();ctx.moveTo(frame*560+(x-170)*4,20);ctx.lineTo(frame*560+(x-170)*4,540);ctx.stroke();ctx.fillStyle='#556';ctx.fillText(x,frame*560+(x-170)*4+2,40);}
          for(let y=80;y<=180;y+=10){ctx.strokeStyle='#a89ca077';ctx.beginPath();ctx.moveTo(frame*560,20+(y-60)*4);ctx.lineTo((frame+1)*560,20+(y-60)*4);ctx.stroke();ctx.fillStyle='#556';ctx.fillText(y,frame*560+3,20+(y-60)*4);}
          for(const p of points){ctx.strokeStyle='#e30054';ctx.beginPath();ctx.arc(frame*560+(p[0]-170)*4,20+(p[1]-60)*4,5,0,Math.PI*2);ctx.stroke();}
        }
        sheets.push({name:'source-'+key,data:sheet.toDataURL()});
      }
      controller.stop();return sheets;
    })()`);
    const target=path.join(os.tmpdir(),'luna-face-alignment');fs.mkdirSync(target,{recursive:true});
    for(const result of results){const bytes=Buffer.from(result.data.split(',')[1],'base64');fs.writeFileSync(path.join(target,result.name+'.png'),bytes);if(result.name.startsWith('anchors-'))for(const [column,outfit]of ['original','jk','secretary','nurse'].entries())fs.writeFileSync(path.join(target,result.name+'-'+outfit+'.png'),nativeImage.createFromBuffer(bytes).crop({x:column*560,y:0,width:560,height:480}).toPNG());}
    console.log('FACE_ALIGNMENT_PREVIEW '+target);
  }finally{win.destroy();app.quit();}
}).catch(error=>{console.error(error);app.exit(1);});
