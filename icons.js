// Shared local SVG geometry: rounded contours as well as rounded strokes.
(()=>{
  const paths={
  "folder": [
    "M3 8V6a2.5 2.5 0 0 1 2.5-2.5H9c1 0 1.4.4 2 1.2L12.7 7h5.8A2.5 2.5 0 0 1 21 9.5v8a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17.5V8Z"
  ],
  "image": [
    "M6 4h12a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3Z",
    "M3.5 16.5 7 12.8q1-1.1 2 0l3.2 3.4q1 1 2 0l1.3-1.4q1-1 2 0l3 3.2",
    "M17.5 8a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Z"
  ],
  "file-add": [
    "M6.5 3H13q1 0 1.7.7l4.6 4.6Q20 9 20 10v8.5a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 18.5v-13A2.5 2.5 0 0 1 6.5 3Z",
    "M14 3.5V7q0 2 2 2h3.5M8 15h8m-4-4v8"
  ],
  "clipboard": [
    "M8 5H6a2.5 2.5 0 0 0-2.5 2.5v11A2.5 2.5 0 0 0 6 21h12a2.5 2.5 0 0 0 2.5-2.5v-11A2.5 2.5 0 0 0 18 5h-2",
    "M9.5 3h5Q16 3 16 4.5v1Q16 7 14.5 7h-5Q8 7 8 5.5v-1Q8 3 9.5 3ZM8 12h8m-8 4h5"
  ],
  "frame": [
    "M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M3 16v3a2 2 0 0 0 2 2h3m8 0h3a2 2 0 0 0 2-2v-3"
  ],
  "capture": [
    "M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M3 16v3a2 2 0 0 0 2 2h3m8 0h3a2 2 0 0 0 2-2v-3",
    "M10 8h4q2 0 2 2v4q0 2-2 2h-4q-2 0-2-2v-4q0-2 2-2Z"
  ],
  "maximize": [
    "M8 5h8q3 0 3 3v8q0 3-3 3H8q-3 0-3-3V8q0-3 3-3Z"
  ],
  "stop": [
    "M9 6h6q3 0 3 3v6q0 3-3 3H9q-3 0-3-3V9q0-3 3-3Z"
  ],
  "copy": [
    "M11.5 9h6a2.5 2.5 0 0 1 2.5 2.5v6a2.5 2.5 0 0 1-2.5 2.5h-6A2.5 2.5 0 0 1 9 17.5v-6a2.5 2.5 0 0 1 2.5-2.5Z",
    "M15 6.5A2.5 2.5 0 0 0 12.5 4h-6A2.5 2.5 0 0 0 4 6.5v6A2.5 2.5 0 0 0 6.5 15H9"
  ],
  "trash": [
    "M4 6h16M9 6V4.5Q9 3 10.5 3h3Q15 3 15 4.5V6",
    "M6 6l.8 12.6Q7 21 9.4 21h5.2q2.4 0 2.6-2.4L18 6M10 10v7m4-7v7"
  ],
  "web": [
    "M6 4h12q3 0 3 3v10q0 3-3 3H6q-3 0-3-3V7q0-3 3-3Z",
    "M3 9h18M7 6.5h.01M10 6.5h.01",
    "m9 12-2 2 2 2m6-4 2 2-2 2"
  ],
  "hanger": [
    "M9 5a3 3 0 0 1 6 0c0 2-3 2-3 4v2",
    "M12 11 4.2 16.2Q3 17 3 18v.5Q3 20 4.5 20h15Q21 20 21 18.5V18q0-1-1.2-1.8L12 11Z"
  ],
  "bell": [
    "M7 9a5 5 0 0 1 10 0v4q0 1.4 1.5 2.8Q20 18 17.5 18h-11Q4 18 5.5 15.8 7 14.4 7 13V9ZM10 21h4M12 2v2"
  ],
  "shirt": [
    "M8 3 3.8 5.5q-.9.5-.5 1.5l1 3q.3 1 1.3.7L8 10v8.5Q8 21 10.5 21h3Q16 21 16 18.5V10l2.4.7q1 .3 1.3-.7l1-3q.4-1-.5-1.5L16 3a4 4 0 0 1-8 0Z"
  ],
  "edit": [
    "m4 16 10.6-10.6q1.4-1.4 2.8 0l1.2 1.2q1.4 1.4 0 2.8L8 20l-4 1q-1 .2-.8-.8L4 16ZM13 7l4 4"
  ],
  "check": [
    "m5 12 4 4L19 6"
  ],
  "expand": [
    "M7 10l5 5 5-5"
  ],
  "refresh": [
    "M20 7V3l-4 4",
    "M20 7a8 8 0 1 0 1 7"
  ],
  "snooze": [
    "M12 3a9 9 0 1 0 9 9",
    "M12 7v5l3 2",
    "M17 3v6h6"
  ]
};
  const ns='http://www.w3.org/2000/svg';
  function draw(svg,name){if(!paths[name])throw Error('Unknown icon');svg.setAttribute('data-icon',name);svg.setAttribute('stroke-linecap','round');svg.setAttribute('stroke-linejoin','round');svg.replaceChildren(...paths[name].map(d=>{const path=document.createElementNS(ns,'path');path.setAttribute('d',d);return path;}));return svg;}
  function create(name){const svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('aria-hidden','true');return draw(svg,name);}
  function hydrate(){for(const svg of document.querySelectorAll('svg[data-icon]'))draw(svg,svg.dataset.icon);}
  window.lunaIcons={create};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',hydrate,{once:true});else hydrate();
})();
