from pathlib import Path
import xml.etree.ElementTree as E
import re,html
p=Path('outputs');d=p/'APP与固件升级-多场景汇总流程.drawio';tree=E.parse(d);cells={c.get('id'):c for c in tree.iter('mxCell')};ns='http://www.w3.org/2000/svg';E.register_namespace('',ns)
def el(tag,attrs={},text=None,parent=None):
 e=E.SubElement(parent if parent is not None else svg,'{'+ns+'}'+tag,{k:str(v) for k,v in attrs.items()});e.text=text;return e
def style(c):return dict(x.split('=',1) for x in c.get('style','').split(';') if '=' in x)
def box(id):
 c=cells[id];g=c.find('mxGeometry');x=float(g.get('x',0));y=float(g.get('y',0));pa=c.get('parent')
 if pa not in ['0','1',None] and cells[pa].get('vertex'):
  a,b,_,_=box(pa);x+=a;y+=b
 return x,y,float(g.get('width',0)),float(g.get('height',0))
canvas_width=tree.find('.//mxGraphModel').get('pageWidth','3000')
svg=E.Element('{'+ns+'}svg',{'width':canvas_width,'height':'10900','viewBox':f'0 0 {canvas_width} 10900','content':d.read_text()});defs=el('defs');m=el('marker',{'id':'arrow','markerWidth':8,'markerHeight':8,'refX':7,'refY':4,'orient':'auto','markerUnits':'userSpaceOnUse'},parent=defs);el('path',{'d':'M0 0 L8 4 L0 8 Z','fill':'#64748b'},parent=m)
el('rect',{'width':canvas_width,'height':10900,'fill':'white'})
verts=[c for c in cells.values() if c.get('vertex')];panels=[c for c in verts if 'swimlane' in c.get('style','')]
for c in panels:
 x,y,w,h=box(c.get('id'));el('rect',{'x':x,'y':y,'width':w,'height':h,'fill':'white','stroke':'#cbd5e1'});el('rect',{'x':x,'y':y,'width':w,'height':50,'fill':'#f1f5f9','stroke':'#cbd5e1'});el('text',{'x':x+w/2,'y':y+32,'text-anchor':'middle','font-size':20,'font-family':'Arial, PingFang SC','fill':'#24324b'},html.unescape(c.get('value','')))
for c in cells.values():
 if not c.get('edge') or c.get('source') not in cells or c.get('target') not in cells:continue
 sx,sy,sw,sh=box(c.get('source'));tx,ty,tw,th=box(c.get('target'));st=style(c);g=c.find('mxGeometry');ox=oy=0
 if c.get('parent') not in ['1','0',None]:ox,oy,_,_=box(c.get('parent'))
 mids=[(float(q.get('x',0))+ox,float(q.get('y',0))+oy) for q in g.findall('./Array/mxPoint')]
 side=tx>=sx+sw and abs(ty-sy)<200
 start=(sx+sw*float(st.get('exitX','1' if side else '.5')),sy+sh*float(st.get('exitY','.5' if side else '1')))
 end=(tx+tw*float(st.get('entryX','.5')),ty+th*float(st.get('entryY','0')))
 raw=[start]+mids+[end];points=[raw[0]]
 for i,b in enumerate(raw[1:]):
  a=points[-1]
  if a[0]!=b[0] and a[1]!=b[1]:
   if i==0 and float(st.get('exitX','1' if side else '.5')) in [0,1]:points.append((b[0],a[1]))
   else:points.append((a[0],b[1]))
  points.append(b)
 el('polyline',{'points':' '.join(f'{a},{b}' for a,b in points),'fill':'none','stroke':'#64748b','stroke-width':1.4,'marker-end':'url(#arrow)'})
 if c.get('value'):
  a=points[0];b=points[1];el('text',{'x':(a[0]+b[0])/2+12,'y':(a[1]+b[1])/2-8,'font-size':15,'font-family':'Arial, PingFang SC','fill':'#24324b','paint-order':'stroke','stroke':'white','stroke-width':4},html.unescape(c.get('value')))
for c in verts:
 if c in panels:continue
 x,y,w,h=box(c.get('id'));st=style(c);fill=st.get('fillColor','#f5f9ff');stroke=st.get('strokeColor','#729bd6');group=el('g',{'data-cell-id':c.get('id')})
 if 'rhombus' in c.get('style',''):el('polygon',{'points':f'{x+w/2},{y} {x+w},{y+h/2} {x+w/2},{y+h} {x},{y+h/2}','fill':fill,'stroke':stroke},parent=group)
 else:el('rect',{'x':x,'y':y,'width':w,'height':h,'rx':8 if 'rounded=1' in c.get('style','') else 0,'fill':fill,'stroke':stroke},parent=group)
 value=html.unescape(c.get('value',''));value=re.sub(r'<br\s*/?>','\n',value);value=re.sub('<[^>]*>','',value);lines=[]
 for line in value.splitlines():
  cur='';width=0
  for ch in line:
   size=15 if ord(ch)>255 else 8
   if width+size>w-22:lines.append(cur);cur='';width=0
   cur+=ch;width+=size
  lines.append(cur)
 t=el('text',{'x':x+w/2,'y':y+h/2-(len(lines)-1)*10+5,'text-anchor':'middle','font-family':'Arial, PingFang SC, Microsoft YaHei, sans-serif','font-size':15,'fill':'#24324b'},parent=group)
 for i,line in enumerate(lines):el('tspan',{'x':x+w/2,'dy':0 if i==0 else 20},line,parent=t)
E.ElementTree(svg).write(p/'APP与固件升级-清晰布局.svg',encoding='utf-8',xml_declaration=True)
h=p/'APP与固件升级-流程图打开.html';h.write_text(re.sub(r'清晰布局.svg\?v=[^" ]+', '清晰布局.svg?v=20261112-d-routing-v14',h.read_text()))
