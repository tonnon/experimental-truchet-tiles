var canvas = document.getElementById("canvas");
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;
var gl = canvas.getContext('webgl');
var dt = 0.025;
var time = 0.20;

var vertexSource = `
attribute vec2 position;
void main() {
  gl_Position = vec4(position, 0.0, 1.0);
}`;

var fragmentSource = `
#define PI 3.14159265358979323846
precision highp float;

uniform float width;
uniform float height;
vec2 u_resolution = vec2(width, height);
uniform float u_time;
uniform vec2 u_mouse;

/* rotation functions: https://thebookofshaders.com/ */
vec2 rotate2D (vec2 _st, float _angle) {
    _st -= 0.5;
    _st =  mat2(cos(_angle),-sin(_angle), sin(_angle),cos(_angle)) * _st;
    _st += 0.5;
    return _st;
}

vec2 rotateTilePattern(vec2 _st){

    _st *= 2.0;

    //Give each cell an index number according to its position
    float index = 0.0;
    index += step(1., mod(_st.x,2.0));
    index += step(1., mod(_st.y,2.0))*2.0;
    _st = fract(_st);

    // Rotate each cell according to the index
    if(index == 1.0){
        _st = rotate2D(_st,PI*0.5);/*90deg*/
    } else if(index == 2.0){
        _st = rotate2D(_st,PI*-0.5);/*-90deg*/
    } else if(index == 3.0){
        _st = rotate2D(_st,PI);/*180deg*/
    }
    return _st;
}

void main (void) {
  vec2 st = gl_FragCoord.xy/u_resolution.xy;/* normalized coords between 0.0 and 1.0 */
  float d = 1.0-distance(st-u_mouse,vec2(0.5));
  st.y *= u_resolution.y/u_resolution.x;/*scale to screen size*/
  
  float periodic = 8.0*sin(u_time+(8.*d));
  st *= 12.0; /*scale up */
  st = rotateTilePattern(st);
  st = rotate2D(st,u_time);
  float angle = st.y * PI * periodic;
  float tangent = (tan(angle));

  float shape = (cos(angle)+sin(angle)+tangent)*tangent;
  shape = step(shape-d,st.x*st.y*(periodic+.5));
  
  //time and distance varying pixel color
  vec3 color = (7.*d)+u_time+st.xyx+vec3(0,9,8);
  color = .8 + 0.5*(tan(color)+cos(color));
  gl_FragColor = vec4(shape*color, 2.0);
}
`;

//************** Utility functions  **************//

window.addEventListener( 'resize', onWindowResize, false );
var mousePos = {x:0, y:0};
window.addEventListener('click', e => {

  const _pos = getNoPaddingNoBorderCanvasRelativeMousePosition(e, gl.canvas);

  // pos is in pixel coordinates for the canvas.
  // so convert to WebGL clip space coordinates
  const x = _pos.x / gl.canvas.width  *  2 - 1;
  const y = _pos.y / gl.canvas.height * -2 + 1;
  mousePos.x = x;
  mousePos.y = y;
  gl.uniform2f(mouseHandle, mousePos.x, mousePos.y);
  return false;
});

/* mouse pos functions: https://stackoverflow.com/a/42315942/244811 */
function getRelativeMousePosition(event, target) {
  target = target || event.target;
  var rect = target.getBoundingClientRect();

  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
  };
}

function getNoPaddingNoBorderCanvasRelativeMousePosition(event, target) {
  target = target || event.target;
  var pos = getRelativeMousePosition(event, target);

  pos.x = pos.x * target.width  / target.clientWidth;
  pos.y = pos.y * target.height / target.clientHeight;

  return pos;  
}
function onWindowResize(){
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
	gl.viewport(0, 0, canvas.width, canvas.height);
  gl.uniform1f(widthHandle, window.innerWidth);
  gl.uniform1f(heightHandle, window.innerHeight);
}

//Compile shader and combine with source
function compileShader(shaderSource, shaderType){
  var shader = gl.createShader(shaderType);
  gl.shaderSource(shader, shaderSource);
  gl.compileShader(shader);
  if(!gl.getShaderParameter(shader, gl.COMPILE_STATUS)){
  	throw "Shader compile failed with: " + gl.getShaderInfoLog(shader);
  }
  return shader;
}

//Utility to complain loudly if we fail to find the attribute/uniform
function getAttribLocation(program, name) {
  var attributeLocation = gl.getAttribLocation(program, name);
  if (attributeLocation === -1) {
  	throw 'Cannot find attribute ' + name + '.';
  }
  return attributeLocation;
}

function getUniformLocation(program, name) {
  var attributeLocation = gl.getUniformLocation(program, name);
  if (attributeLocation === -1) {
  	throw 'Cannot find uniform ' + name + '.';
  }
  return attributeLocation;
}

//************** Create shaders **************

//Create vertex and fragment shaders
var vertexShader = compileShader(vertexSource, gl.VERTEX_SHADER);
var fragmentShader = compileShader(fragmentSource, gl.FRAGMENT_SHADER);

//Create shader programs
var program = gl.createProgram();
gl.attachShader(program, vertexShader);
gl.attachShader(program, fragmentShader);
gl.linkProgram(program);
gl.useProgram(program);

//Set up rectangle covering entire canvas 
var vertexData = new Float32Array([
  -1.0,  1.0, 	// top left
  -1.0, -1.0, 	// bottom left
   1.0,  1.0, 	// top right
   1.0, -1.0, 	// bottom right
]);

//Create vertex buffer
var vertexDataBuffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, vertexDataBuffer);
gl.bufferData(gl.ARRAY_BUFFER, vertexData, gl.STATIC_DRAW);

// Layout of our data in the vertex buffer
var positionHandle = getAttribLocation(program, 'position');

gl.enableVertexAttribArray(positionHandle);
gl.vertexAttribPointer(positionHandle,
  2, 				// position is a vec2 (2 values per component)
  gl.FLOAT, // each component is a float
  false, 		// don't normalize values
  2 * 4, 		// two 4 byte float components per vertex (32 bit float is 4 bytes)
  0 				// how many bytes inside the buffer to start from
  );

//Set uniform handles
var timeHandle = getUniformLocation(program, 'u_time');
var widthHandle = getUniformLocation(program, 'width');
var heightHandle = getUniformLocation(program, 'height');
var mouseHandle = getUniformLocation(program, 'u_mouse');

gl.uniform1f(widthHandle, window.innerWidth);
gl.uniform1f(heightHandle, window.innerHeight);

function draw(){
 
  time += dt;
  gl.uniform1f(timeHandle, time);
  
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  requestAnimationFrame(draw);
}

draw();