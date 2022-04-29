if (!Detector.webgl) Detector.addGetWebGLMessage();

var headFollow = true;
var eyesFollow = true;

var eyesLookCenter = false;
var eyesLookTrack = false;
var eyesLookTarget = false;

var behavior = 0;

var lastEyesX = 0;
var lastEyesY = 0;

var eyeTargetTimer = 0;
var eyeTargetX = 0;
var eyeTargetY = 0;

var behaviorTimer = 0;

var mixBehaviors = false;

var yOffset = 0;

var SCALE = 1;
var MARGIN = 100;
var SIDE_MARGIN = 0;

var BRIGHTNESS = 1;

var SCREEN_WIDTH = window.innerWidth - 2 * SIDE_MARGIN;
var SCREEN_HEIGHT = window.innerHeight - 2 * MARGIN;

var backend = "webgl1";

var isMobile = Detector.isMobile;

var useDeferred = true;
var useDebugMaterial = false;

if (!Detector.deferredCapable || isMobile) useDeferred = false;

var LOW_THRESHOLD = 1000;
var ULTRA_THRESHOLD = 2000;
var isUltra = false;
var isLow = false;

if (isMobile) isLow = true;

//

var infoDesktopElement = document.getElementById("info_desktop");
var infoMobileElement = document.getElementById("info_mobile");

if (isMobile) {
  infoMobileElement.style.display = "inline-block";
  mixBehaviors = false;
} else {
  infoDesktopElement.style.display = "inline-block";
  mixBehaviors = false;
}

//

var container, camera, scene, renderer, innerRenderer;

var mesh;
var meshRoot;

var planeMaterial;
var planeMesh;

var overlayMaterial;
var overlayMesh;

var borderMeshRight, borderMeshLeft;
var borderMeshTop, borderMeshBottom;

var effectSharpen, effectLens;

var parameters = {
  // behavior 1

  eyeScaleX1: 1.0,
  eyeScaleY1: 1.0,

  headScaleX1: 1.0,
  headScaleY1: 1.0,

  // behavior 2

  eyeScaleX2: -0.35,
  eyeScaleY2: 0.25,

  headScaleX2: 1.0,
  headScaleY2: 1.0,

  // behavior 3

  eyeScaleX3: -0.3,
  eyeScaleY3: -0.2,

  headScaleX3: 1.0,
  headScaleY3: 1.0,

  // behavior 4

  eyeScaleX4: 1.0,
  eyeScaleY4: 1.0,

  headScaleX4: 1.0,
  headScaleY4: 1.0,

  targetScaleX: 1.0,
  targetScaleY: 0.5,

  eyeTargetMix: 0.5,
  headEyeMix: 0.5,

  timerMin: 1.0,
  timerDur: 2.0,
  targetTimer: 0.0,

  // behavior 5

  behaviorTimer: 0.0,

  bRndMin: 1.0,
  bRndDur: 3.0,

  bFwdMin: 1.0,
  bFwdDur: 1.0,

  bFolMin: 1.0,
  bFolDur: 2.0,

  activeBehavior: "none",

  // common

  eyeVelocity: 5.5,
  headVelocity: 3.0,

  input: "none",
};

if (isMobile) {
  parameters.eyeVelocity = 6;
  parameters.headVelocity = 4;
}

//

var characterIndex = 0;

var characterList = [
  {
    id: "albert02",

    baseUrl: "textures/eyes/albert/",

    rollSpritesUrl: "einstein2b_roll_sprites_fix.jpg",
    scrollSpritesUrl: "einstein2b_scroll_sprites_fix.jpg",
    shiftSpritesUrl: "einstein2b_shift_sprites_fix.jpg",

    maskSize: [512, 683],
    maskBoundingBox: [193, 236, 391, 285],

    depthUrl: "einstein2.depth.blurred2.jpg",

    highUrl: "einstein2b-50-g.jpg",
    highMaskUrl: "einstein2_mask2.png",

    borderSide: 105,
    borderTop: 125,
    borderBottom: 117,

    gamma: 1.1,
    brightness: 1.2,
    sharpen: true,

    scale: 0.75,
    positionY: 0.05,
    tiltX: 0.02,

    displacementScale: 0.7,
    displacementMap: null,

    loadCounter: 0,

    credit: "photo of",
    author: "Albert Einstein",
    url: "https://en.wikipedia.org/wiki/Albert_Einstein",
  },
];

//

var characterMap = {};

for (var i = 0, il = characterList.length; i < il; i++) {
  var id = characterList[i].id;
  characterMap[id] = i;
}

// ui

var loadingElement = document.getElementById("loading");
var loadingVisible = true;

var creditElement = document.getElementById("credit");
var authorElement = document.getElementById("author");

var infoElement = document.getElementById("info");
var hudVisible = true;

// gui

var f0, f1, f2, f3, f4, f5;

// camera controls

var mouseX = 0;
var mouseY = 0;

var targetX = 0.0;
var targetY = 0.0;
var angle = 0.0;
var height = 0.0;
var target = new XG.Vector3();

var windowHalfX = window.innerWidth / 2;
var windowHalfY = window.innerHeight / 2;

//

var clock = new XG.Clock();
var elapsed = 0;

var diffuseComposer;
var diffuseUniforms;

var dummyBlackMap = XG.ImageUtils.generateDataTexture(
  4,
  4,
  new XG.Color(0x000000)
);
var dummyWhiteMap = XG.ImageUtils.generateDataTexture(
  4,
  4,
  new XG.Color(0xffffff)
);

var dummyObj;

//

init();
animate();

function init() {
  container = document.createElement("div");
  container.className = "container";
  document.body.appendChild(container);

  // performance

  var gpuDetector = new GPUDetector();
  gpuData = gpuDetector.detectGPU();

  if (gpuData && gpuData.rawScore < LOW_THRESHOLD) {
    isLow = true;
    useDeferred = false;
  }

  // camera

  camera = new XG.PerspectiveCamera(13, SCREEN_WIDTH / SCREEN_HEIGHT, 50, 1500);
  camera.position.set(0, 0, 200);

  // scene

  scene = new XG.Scene();
  scene.add(camera);

  // renderer

  var pars = {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    scale: SCALE,
    antialias: true,
    tonemapping: XG.SimpleOperator,
    brightness: BRIGHTNESS,
    clearColor: 0x000000,
    clearAlpha: 1.0,
    //"devicePixelRatio" : 1,
    backend: backend,
    //"dither"	: true
  };

  if (isMobile) {
    //pars.antialias = false;
  }

  if (useDeferred) {
    renderer = new XG.DeferredRenderer(pars);
    innerRenderer = renderer.renderer;

    renderer.dofEnabled = true;
    //renderer.dofAutofocus = true;
    renderer.dofFancy = true;

    renderer.dofFocusDistance = 210;

    renderer.dofLensFstop = 2;
    renderer.dofLensBlurScale = 8;

    renderer.occludersEnabled = true;

    var fovRad = XG.Math.degToRad(camera.fov);
    renderer.dofLensFocalLength = XG.Math.fovToFocalLength(fovRad, 24);
  } else {
    renderer = new XG.ForwardRenderer(pars);
    innerRenderer = renderer;
  }

  container.appendChild(renderer.domElement);

  renderer.domElement.style.position = "absolute";
  renderer.domElement.style.top = MARGIN + "px";
  renderer.domElement.style.left = SIDE_MARGIN + "px";

  //

  renderer.shadowMapEnabled = false;

  //

  if (useDeferred) {
    effectSharpen = new XG.ShaderPass(XG.SharpenShader);
    effectSharpen.uniforms.resolution.value.set(
      SCREEN_WIDTH * SCALE,
      SCREEN_HEIGHT * SCALE
    );

    effectLens = new XG.ShaderPass(XG.ChromaticAberrationShader);
    effectLens.material.uniforms.amount.value = 0.00125;

    renderer.addEffect(effectSharpen);
    //renderer.addEffect( effectLens );
  }

  // stats

  stats = new Stats();
  container.appendChild(stats.domElement);

  // events

  window.addEventListener("resize", onWindowResize, false);
  document.addEventListener("mousemove", onDocumentMouseMove, false);
  document.addEventListener("touchmove", onTouchMove, {
    passive: false,
  });
  renderer.domElement.addEventListener("click", onClick, false);
  document.addEventListener("keydown", onKeyDown, false);
  renderer.domElement.addEventListener("wheel", onDocumentWheel, false);

  addBorders();

  if (useDebugMaterial) {
    light = new XG.PointLight(0xffffff, 4, 1000);
    light.position.z = 100;
    light.position.y = 20;
    scene.add(light);

    light = new XG.PointLight(0xffaa00, 4, 1000);
    light.position.z = 100;
    light.position.x = 100;
    scene.add(light);

    light = new XG.PointLight(0x00aaff, 4, 1000);
    light.position.z = 100;
    light.position.x = -100;
    scene.add(light);
  }

  var initCharacter = getHash(window.location.href);
  var initId = characterMap[initCharacter];
  if (initId === undefined) initId = 0;

  console.log(initCharacter, initId);

  characterIndex = initId;

  addCharacter();
  setTextures(characterIndex);

  var nextCharacterIndex1 = (characterIndex + 1) % characterList.length;
  var nextCharacterIndex2 = (characterIndex + 2) % characterList.length;
  loadTextures(nextCharacterIndex1);
  loadTextures(nextCharacterIndex2);

  setupDynamicTexture();

  // gui

  initGUI();

  // init behavior

  setBehavior(1);
  behaviorTimer = 4;

  // INITIAL STATE

  if (gpuData && gpuData.rawScore >= ULTRA_THRESHOLD) {
    isUltra = true;

    if (useDeferred) {
      //renderer.dofEnabled = true;
      //renderer.occludersEnabled = true;
    }
  } else {
    if (useDeferred) renderer.setScale(0.75 / window.devicePixelRatio);
  }

  //

  onWindowResize();
}

// -----------------------------------------------------------------------------------

function initGUI() {
  var gui = new dat.GUI();

  f0 = gui.addFolder("Common");
  f0.add(parameters, "input").listen();
  f0.add(parameters, "eyeVelocity", 1.0, 20.0, 0.01);
  f0.add(parameters, "headVelocity", 1.0, 20.0, 0.01);
  f0.open();

  f1 = gui.addFolder("Behavior 1 (followTarget)");
  f1.add(parameters, "eyeScaleX1", -1.0, 1.0, 0.01);
  f1.add(parameters, "eyeScaleY1", -1.0, 1.0, 0.01);
  f1.add(parameters, "headScaleX1", -1.5, 1.5, 0.01);
  f1.add(parameters, "headScaleY1", -1.5, 1.5, 0.01);
  //f1.open();

  f2 = gui.addFolder("Behavior 2 (lookForward)");
  f2.add(parameters, "eyeScaleX2", -1.0, 1.0, 0.01);
  f2.add(parameters, "eyeScaleY2", -1.0, 1.0, 0.01);
  f2.add(parameters, "headScaleX2", -1.5, 1.5, 0.01);
  f2.add(parameters, "headScaleY2", -1.5, 1.5, 0.01);
  //f2.open();

  f3 = gui.addFolder("Behavior 3 (lookForward)");
  f3.add(parameters, "eyeScaleX3", -1.0, 1.0, 0.01);
  f3.add(parameters, "eyeScaleY3", -1.0, 1.0, 0.01);
  f3.add(parameters, "headScaleX3", -1.5, 1.5, 0.01);
  f3.add(parameters, "headScaleY3", -1.5, 1.5, 0.01);
  //f3.open();

  f4 = gui.addFolder("Behavior 4 (lookRandom)");
  f4.add(parameters, "eyeScaleX4", -1.0, 1.0, 0.01);
  f4.add(parameters, "eyeScaleY4", -1.0, 1.0, 0.01);
  f4.add(parameters, "headScaleX4", -1.5, 1.5, 0.01);
  f4.add(parameters, "headScaleY4", -1.5, 1.5, 0.01);
  f4.add(parameters, "targetScaleX", 0.0, 1.0, 0.01);
  f4.add(parameters, "targetScaleY", 0.0, 1.0, 0.01);

  f4.add(parameters, "eyeTargetMix", 0.0, 1.0, 0.01);
  f4.add(parameters, "headEyeMix", 0.0, 1.0, 0.01);

  f4.add(parameters, "timerMin", 0.5, 10.0, 0.01);
  f4.add(parameters, "timerDur", 0.5, 10.0, 0.01);
  f4.add(parameters, "targetTimer", 0.0, 10.0, 0.01).listen();
  //f4.open();

  f5 = gui.addFolder("Behavior 5");
  f5.add(parameters, "activeBehavior").listen();
  f5.add(parameters, "bRndMin", 0.5, 10.0, 0.01);
  f5.add(parameters, "bRndDur", 0.5, 10.0, 0.01);
  f5.add(parameters, "bFwdMin", 0.5, 10.0, 0.01);
  f5.add(parameters, "bFwdDur", 0.5, 10.0, 0.01);
  f5.add(parameters, "bFolMin", 0.5, 10.0, 0.01);
  f5.add(parameters, "bFolDur", 0.5, 10.0, 0.01);
  f5.add(parameters, "behaviorTimer", 0.0, 10.0, 0.01).listen();
  //f5.open();

  //gui.close();
  gui.__proto__.constructor.toggleHide();
}

// -----------------------------------------------------------------------------------

function toggleUltra() {
  isUltra = !isUltra;

  if (useDeferred) {
    //renderer.setDOF( isUltra );
    //renderer.occludersEnabled = isUltra;

    if (isUltra) renderer.setScale(1 / window.devicePixelRatio);
    else renderer.setScale(0.75 / window.devicePixelRatio);
  }
}

// -----------------------------------------------------------------------------------

function getHash(a) {
  var a = a.split("#");
  if (a.length === 2) return a[1];

  return "";
}

function setHash(a) {
  if (isMobile) return;

  window.location.hash = a;
}

// -----------------------------------------------------------------------------------

function addBorders() {
  var geo = new XG.PlaneGeometry(200, 200);
  var mat = new XG.EmissiveMaterial({
    color: 0x000000,
  });

  mat.occluder = true;

  var d = 118;
  var z = 50;

  borderMeshRight = new XG.Mesh(geo, mat);
  borderMeshRight.position.z = z;
  borderMeshRight.position.x = d;

  scene.add(borderMeshRight);

  borderMeshLeft = new XG.Mesh(geo, mat);
  borderMeshLeft.position.z = z;
  borderMeshLeft.position.x = -d;

  scene.add(borderMeshLeft);

  var geo = new XG.PlaneGeometry(200, 100);

  var d = 118;

  borderMeshTop = new XG.Mesh(geo, mat);
  borderMeshTop.position.z = z;
  borderMeshTop.position.y = d;

  scene.add(borderMeshTop);

  var d = 115;

  borderMeshBottom = new XG.Mesh(geo, mat);
  borderMeshBottom.position.z = z;
  borderMeshBottom.position.y = -d;

  scene.add(borderMeshBottom);
}

// -----------------------------------------------------------------------------------

function generateLoadChecker(index) {
  return function checkLoaded() {
    var pars = characterList[index];

    pars.loadCounter += 1;

    if (pars.loadCounter >= 6) {
      pars.loaded = true;
      if (characterIndex === index) loadingElement.style.display = "none";
    }
  };
}

// -----------------------------------------------------------------------------------

function onWindowResize(event) {
  if (isMobile) {
    if (window.innerWidth > window.innerHeight) {
      // landscape

      MARGIN = 25;
    } else {
      // portrait

      MARGIN = 100;
    }
  }

  SCREEN_WIDTH = window.innerWidth - 2 * SIDE_MARGIN;
  SCREEN_HEIGHT = window.innerHeight - 2 * MARGIN;

  renderer.setSize(SCREEN_WIDTH, SCREEN_HEIGHT);

  renderer.domElement.style.top = MARGIN + "px";
  renderer.domElement.style.left = SIDE_MARGIN + "px";

  camera.aspect = SCREEN_WIDTH / SCREEN_HEIGHT;
  camera.updateProjectionMatrix();

  if (useDeferred) {
    effectSharpen.uniforms.resolution.value.set(
      SCREEN_WIDTH * SCALE,
      SCREEN_HEIGHT * SCALE
    );
  }

  windowHalfX = window.innerWidth / 2;
  windowHalfY = window.innerHeight / 2;
}

// ---------------------------------------------------------------------------------------------------------------

function onDocumentWheel(event) {
  var unit = event.deltaMode;

  var scale = 1;

  if (unit === 0) scale = 0.01; // pixels
  else if (unit === 1) scale = 0.1; // lines

  camera.fov += event.deltaY * scale;

  if (camera.fov > 40) {
    camera.fov = 40;
  }

  if (camera.fov < 7) {
    camera.fov = 7;
  }

  camera.updateProjectionMatrix();

  var fovRad = XG.Math.degToRad(camera.fov);
  renderer.dofLensFocalLength = XG.Math.fovToFocalLength(fovRad, 24);
}

function onDocumentMouseMove(event) {
  mouseX = (event.clientX - windowHalfX) * 1;
  mouseY = (event.clientY - windowHalfY) * 1;

  //mouseY = mouseY * 2 - 1;
}

function onTouchMove(event) {
  event.preventDefault();

  var touches = event.touches;
  var touch = touches[0];

  mouseX = (touch.clientX - windowHalfX) * 1;
  mouseY = (touch.clientY - windowHalfY) * 1;
}

function onClick(event) {
  switchToNextCharacter();
}

function onKeyDown(event) {
  switch (event.keyCode) {
    case 37:
    /*left*/
    case 65:
      /*A*/ switchToPreviousCharacter();
      break;

    case 39:
    /*right*/
    case 68:
      /*D*/ switchToNextCharacter();
      break;

    case 32:
      /*space*/ switchToNextCharacter();
      break;

    case 73:
      /*I*/ toggleHUD();
      break;
    case 83:
      /*S*/ toggleSharpen();
      break;
    case 76:
      /*L*/ toggleLens();
      break;
    case 77:
      /*M*/ toggleMargins();
      break;

    case 80:
      /*P*/ toggleDOF();
      break;
    case 85:
      /*U*/ if (!event.ctrlKey) toggleUltra();
      break;

    case 49:
      /*1*/ mixBehaviors = false;
      setBehavior(1);
      break;
    case 50:
      /*2*/ mixBehaviors = false;
      setBehavior(2);
      break;
    case 51:
      /*3*/ mixBehaviors = false;
      setBehavior(3);
      break;
    case 52:
      /*4*/ mixBehaviors = false;
      setBehavior(4);
      break;
    case 53:
      /*5*/ mixBehaviors = true;
      setBehavior(4);
      break;
  }
}

// -----------------------------------------------------------------------------------

function setBehavior(n) {
  behavior = n;

  closeAllGuiFolders();

  switch (behavior) {
    case 1:
      f1.open();
      break;

    case 2:
      f2.open();
      break;

    case 3:
      f3.open();
      if (mixBehaviors) {
        f4.open();
        f5.open();

        parameters.activeBehavior = "lookForward";
      }
      break;

    case 4:
      f4.open();
      if (mixBehaviors) {
        f3.open();
        f5.open();

        parameters.activeBehavior = "lookRandom";
      }
      break;

    case 5:
      f3.open();
      f4.open();
      f5.open();
      break;
  }
}

function closeAllGuiFolders() {
  f1.close();
  f2.close();
  f3.close();
  f4.close();
  f5.close();
}

// -----------------------------------------------------------------------------------

function toggleDOF() {
  if (useDeferred) renderer.setDOF(!renderer.dofEnabled);
}

// -----------------------------------------------------------------------------------

function toggleMargins() {
  if (MARGIN === 0) {
    MARGIN = 100;
  } else {
    MARGIN = 0;
  }

  onWindowResize();
}

// -----------------------------------------------------------------------------------

function toggleSharpen() {
  if (!useDeferred) return;

  var pars = characterList[characterIndex];

  pars.sharpen = !pars.sharpen;
}

function toggleLens() {
  if (!useDeferred) return;

  effectLens.enabled = !effectLens.enabled;
}

// -----------------------------------------------------------------------------------

function toggleHUD() {
  if (hudVisible) {
    stats.domElement.style.display = "none";
    infoElement.style.display = "none";

    hudVisible = false;
  } else {
    stats.domElement.style.display = "block";
    infoElement.style.display = "block";

    hudVisible = true;
  }
}

// -----------------------------------------------------------------------------------

function checkLoadStatus(index) {
  var pars = characterList[index];

  if (pars.loaded) {
    loadingElement.style.display = "none";
  } else {
    loadingElement.style.display = "block";
  }
}

// -----------------------------------------------------------------------------------

function switchToNextCharacter() {
  characterIndex = (characterIndex + 1) % characterList.length;
  setTextures(characterIndex);

  var nextCharacterIndex = (characterIndex + 1) % characterList.length;
  var nextCharacterIndex2 = (characterIndex + 2) % characterList.length;
  loadTextures(nextCharacterIndex);
  loadTextures(nextCharacterIndex2);

  checkLoadStatus(characterIndex);

  setBehavior(1);
  behaviorTimer = XG.Math.randomFloat(1, 5);
}

function switchToPreviousCharacter() {
  characterIndex = (characterIndex - 1) % characterList.length;
  if (characterIndex < 0) characterIndex += characterList.length;

  setTextures(characterIndex);

  checkLoadStatus(characterIndex);
}

// -----------------------------------------------------------------------------------

function addCharacter() {
  var d = 4.75;
  var nSegments = 100;
  var aspectRatio = 1;

  var geometry = new XG.HeightfieldGeometry(
    d * aspectRatio,
    d,
    nSegments * 2,
    nSegments
  );

  var uvs = geometry.attributes.uv.array;
  for (var i = 0, il = uvs.length; i < il; i += 2) {
    uvs[i + 1] = 1.0 - uvs[i + 1];
  }

  // material

  if (useDebugMaterial) {
    planeMaterial = new XG.PhongMaterial({
      color: 0xffffff,
      map: dummyBlackMap,
    });

    planeMaterial.bumpMap = dummyBlackMap;
    planeMaterial.bumpScale = 4;
  } else {
    planeMaterial = new XG.EmissiveMaterial({
      color: 0xffffff,
      map: dummyBlackMap,
    });

    planeMaterial.occluder = true;
  }

  planeMaterial.displacementMap = dummyBlackMap;
  planeMaterial.displacementScale = 0.5;

  meshRoot = new XG.Node();
  meshRoot.scale.multiplyScalar(50);
  meshRoot.position.y = yOffset;

  planeMesh = new XG.Mesh(geometry, planeMaterial);
  planeMesh.rotation.x = Math.PI * 0.5;
  planeMesh.position.y = 0.0;
  meshRoot.add(planeMesh);

  scene.add(meshRoot);

  // overlay

  overlayMaterial = new XG.EmissiveMaterial({
    color: 0xffffff,
    map: dummyBlackMap,
  });

  overlayMaterial.displacementMap = dummyBlackMap;
  overlayMaterial.displacementScale = 0.5;

  overlayMaterial.transparent = true;

  overlayMesh = new XG.Mesh(geometry, overlayMaterial);
  overlayMesh.rotation.x = Math.PI * 0.5;
  overlayMesh.position.y = 0.25 - 0.15;
  overlayMesh.position.z = 1.25;
  meshRoot.add(overlayMesh);

  overlayMesh.visible = false;
}

// -----------------------------------------------------------------------------------

function loadTextures(index) {
  var pars = characterList[index];

  if (pars.displacementMap === null) {
    console.log("Loading textures for character:", index);

    var baseUrl = pars.baseUrl;
    var frameUrlRoll = pars.frameUrlRoll;
    var frameUrlScroll = pars.frameUrlScroll;
    var frameUrlShift = pars.frameUrlShift;

    var depthUrl = pars.depthUrl;
    var overlayUrl = pars.overlayUrl;
    var overlayDepthUrl = pars.overlayDepthUrl;

    var highUrl = pars.highUrl;
    var highMaskUrl = pars.highMaskUrl;

    var rollSpritesUrl = pars.rollSpritesUrl;
    var scrollSpritesUrl = pars.scrollSpritesUrl;
    var shiftSpritesUrl = pars.shiftSpritesUrl;

    // -----------------------------------------------------------

    var checkLoaded = generateLoadChecker(index);

    var displacementMap = XG.ImageUtils.loadTexture(
      baseUrl + depthUrl,
      checkLoaded
    );
    //displacementMap.anisotropy = 8;

    pars.displacementMap = displacementMap;

    if (highUrl && highMaskUrl) {
      var highMap = XG.ImageUtils.loadTexture(baseUrl + highUrl, checkLoaded);
      highMap.anisotropy = 8;

      pars.highMap = highMap;

      var highMaskMap = XG.ImageUtils.loadTexture(
        baseUrl + highMaskUrl,
        checkLoaded
      );
      highMaskMap.anisotropy = 8;

      pars.highMaskMap = highMaskMap;
    } else {
      pars.highMaskMap = dummyWhiteMap;
    }

    // -----------------------------------------------------------

    var diffuseMapRollSprites = XG.ImageUtils.loadTexture(
      baseUrl + rollSpritesUrl,
      checkLoaded
    );
    var diffuseMapScrollSprites = XG.ImageUtils.loadTexture(
      baseUrl + scrollSpritesUrl,
      checkLoaded
    );
    var diffuseMapShiftSprites = XG.ImageUtils.loadTexture(
      baseUrl + shiftSpritesUrl,
      checkLoaded
    );

    diffuseMapRollSprites.anisotropy = 8;
    diffuseMapScrollSprites.anisotropy = 8;
    diffuseMapShiftSprites.anisotropy = 8;

    //diffuseMapRollSprites.wrapS = diffuseMapRollSprites.wrapT = XG.RepeatWrapping;
    //diffuseMapScrollSprites.wrapS = diffuseMapScrollSprites.wrapT = XG.RepeatWrapping;
    //diffuseMapShiftSprites.wrapS = diffuseMapShiftSprites.wrapT = XG.RepeatWrapping;

    pars.rollSpritesMap = diffuseMapRollSprites;
    pars.scrollSpritesMap = diffuseMapScrollSprites;
    pars.shiftSpritesMap = diffuseMapShiftSprites;

    // -----------------------------------------------------------

    if (overlayUrl) {
      var overlayMap = XG.ImageUtils.loadTexture(
        baseUrl + overlayUrl,
        checkLoaded
      );
      overlayMap.anisotropy = 8;
      overlayMap.premultiplyAlpha = true;

      pars.overlayMap = overlayMap;

      if (overlayDepthUrl) {
        var overlayDisplacementMap = XG.ImageUtils.loadTexture(
          baseUrl + overlayDepthUrl,
          checkLoaded
        );
        //overlayDisplacementMap.anisotropy = 8;

        pars.overlayDisplacementMap = overlayDisplacementMap;
      }
    }
  }
}

// -----------------------------------------------------------------------------------

function setTextures(index) {
  var pars = characterList[index];

  loadTextures(index);

  planeMaterial.displacementMap = pars.displacementMap;
  planeMaterial.displacementScale =
    pars.displacementScale !== undefined ? pars.displacementScale : 1.0;

  planeMaterial.bumpMap = pars.displacementMap;

  var imgWidth = pars.maskSize[0];
  var imgHeight = pars.maskSize[1];

  var aspectRatio = imgWidth / imgHeight;
  var scale = pars.scale !== undefined ? pars.scale : 1.0;
  var positionY = pars.positionY !== undefined ? pars.positionY : 0.25;
  var tiltX = pars.tiltX !== undefined ? pars.tiltX : 0.0;

  planeMesh.scale.x = aspectRatio * scale;
  planeMesh.scale.z = scale;
  planeMesh.position.y = positionY - yOffset / 50;

  planeMesh.rotation.x = Math.PI * (0.5 + tiltX);

  if (pars.overlayMap) {
    overlayMaterial.map = pars.overlayMap;
    overlayMaterial.displacementMap = pars.overlayDisplacementMap;
    overlayMaterial.displacementScale =
      pars.overlayDisplacementScale !== undefined
        ? pars.overlayDisplacementScale
        : 1.0;

    overlayMesh.scale.x = aspectRatio * scale;
    overlayMesh.scale.z = scale;

    overlayMesh.position.z = pars.overlayPositionZ;

    if (pars.overlayPositionY !== undefined)
      overlayMesh.position.y = pars.overlayPositionY;
    if (pars.overlayPositionX !== undefined)
      overlayMesh.position.x = pars.overlayPositionX;

    overlayMesh.visible = true;
  } else {
    overlayMesh.visible = false;
  }

 

  planeMesh.properties.deferredNeedsUpdate = true;

  var borderSide = pars.borderSide !== undefined ? pars.borderSide : 200;
  var borderTop = pars.borderTop !== undefined ? pars.borderTop : 200;
  var borderBottom = pars.borderBottom !== undefined ? pars.borderBottom : 200;

  borderSide += 50;

  borderMeshRight.position.x = borderSide;
  borderMeshLeft.position.x = -borderSide;

  borderMeshTop.position.y = borderTop;
  borderMeshBottom.position.y = -borderBottom;

  //

  var id = pars.id;
  //setHash( id );
}

// -----------------------------------------------------------------------------------

function setupDynamicTexture() {
  var nx = isLow ? 2 : 4;
  var ny = isLow ? 2 : 4;

  var rtWidth = 512 * nx;
  var rtHeight = 512 * ny;

  var rtParamsUByte = {
    minFilter: XG.LinearMipMapLinearFilter,
    magFilter: XG.LinearFilter,
    stencilBuffer: false,
    format: XG.RGBAFormat,
    type: XG.UnsignedByteType,
  };

  var rtDiffuse = new XG.RenderTarget(rtWidth, rtHeight, rtParamsUByte);
  rtDiffuse.generateMipmaps = true;
  rtDiffuse.depthBuffer = false;
  rtDiffuse.stencilBuffer = false;
  rtDiffuse.anisotropy = 8;

  var vertexShader = XG.ShaderChunk["vertexShaderFullscreenTriangleUV"];

  var uniformsDiffuse = {
    diffuseSourceA: {
      type: "t",
      value: null,
    },
    diffuseSourceB: {
      type: "t",
      value: null,
    },
    diffuseSourceC: {
      type: "t",
      value: null,
    },

    highDiffuse: {
      type: "t",
      value: null,
    },
    highMask: {
      type: "t",
      value: null,
    },

    maskSize: {
      type: "v2",
      value: new XG.Vector2(0.0, 0.0),
    },
    maskBoundingBox: {
      type: "v4",
      value: new XG.Vector4(0.0, 0.0, 0.0, 0.0),
    },

    indexA: {
      type: "v2",
      value: new XG.Vector2(0.0, 0.0),
    },
    indexB: {
      type: "v2",
      value: new XG.Vector2(0.0, 0.0),
    },
    indexC: {
      type: "v2",
      value: new XG.Vector2(0.0, 0.0),
    },

    ratioA: {
      type: "f",
      value: 0.0,
    },
    ratioB: {
      type: "f",
      value: 0.0,
    },
    ratioC: {
      type: "f",
      value: 0.0,
    },

    strengthA: {
      type: "f",
      value: 0.0,
    },
    strengthB: {
      type: "f",
      value: 0.0,
    },
    strengthC: {
      type: "f",
      value: 0.0,
    },

    gamma: {
      type: "f",
      value: 1.0,
    },
    brightness: {
      type: "f",
      value: 1.0,
    },
  };

  var fragmentShaderDiffuse = [
    "uniform sampler2D diffuseSourceA;",
    "uniform sampler2D diffuseSourceB;",
    "uniform sampler2D diffuseSourceC;",

    "uniform sampler2D highDiffuse;",
    "uniform sampler2D highMask;",

    "uniform vec2 maskSize;",
    "uniform vec4 maskBoundingBox;",

    "uniform vec2 indexA;",
    "uniform vec2 indexB;",
    "uniform vec2 indexC;",

    "uniform float ratioA;",
    "uniform float ratioB;",
    "uniform float ratioC;",

    "uniform float strengthA;",
    "uniform float strengthB;",
    "uniform float strengthC;",

    "uniform float gamma;",
    "uniform float brightness;",

    "varying vec2 vUv;",

    "void main() {",

    "const float nSprites = 20.0;",

    "vec2 uvScale = vec2( maskSize.x / ( maskBoundingBox.z - maskBoundingBox.x ), maskSize.y / ( maskBoundingBox.w - maskBoundingBox.y ) );",
    "vec2 uvOffset = vec2( -maskBoundingBox.x / maskSize.x, -(1.0 - maskBoundingBox.w / maskSize.y) );",

    "vec2 uvBase = ( vUv + uvOffset ) * uvScale * vec2( 1.0, 1.0/nSprites );",

    "vec4 texelA1 = texture2D( diffuseSourceA, uvBase + vec2( 0.0, ( nSprites - 1.0 - indexA.x ) / nSprites ) );",
    "vec4 texelA2 = texture2D( diffuseSourceA, uvBase + vec2( 0.0, ( nSprites - 1.0 - indexA.y ) / nSprites ) );",

    "vec4 texelB1 = texture2D( diffuseSourceB, uvBase + vec2( 0.0, ( nSprites - 1.0 - indexB.x ) / nSprites ) );",
    "vec4 texelB2 = texture2D( diffuseSourceB, uvBase + vec2( 0.0, ( nSprites - 1.0 - indexB.y ) / nSprites ) );",

    "vec4 texelC1 = texture2D( diffuseSourceC, uvBase + vec2( 0.0, ( nSprites - 1.0 - indexC.x ) / nSprites ) );",
    "vec4 texelC2 = texture2D( diffuseSourceC, uvBase + vec2( 0.0, ( nSprites - 1.0 - indexC.y ) / nSprites ) );",

    "vec4 texelH = texture2D( highDiffuse, vUv );",
    "vec4 texelHM = texture2D( highMask, vUv );",

    "vec4 colorA = mix( texelA1, texelA2, ratioA );",
    "vec4 colorB = mix( texelB1, texelB2, ratioB );",
    "vec4 colorC = mix( texelC1, texelC2, ratioC );",

    "vec4 colorMixed = colorA * strengthA + colorB * strengthB + colorC * strengthC;",

    "gl_FragColor.rgb = mix( texelH.rgb, colorMixed.rgb, texelHM.r );",

    "gl_FragColor.rgb = pow( gl_FragColor.rgb, vec3( gamma ) ) * brightness;",

    "}",
  ].join("\n");

  var diffuseShader = {
    fragmentShader: fragmentShaderDiffuse,
    vertexShader: vertexShader,
    uniforms: uniformsDiffuse,
  };

  var passDiffuse = new XG.ShaderPass(diffuseShader);

  diffuseComposer = new XG.EffectComposer(innerRenderer, rtDiffuse);
  diffuseComposer.addPass(passDiffuse);

  diffuseUniforms = passDiffuse.uniforms;

  if (!useDebugMaterial) {
    planeMaterial.map = diffuseComposer.renderTarget1;
  }

  diffuseUniforms["diffuseSourceA"].value = dummyBlackMap;
  diffuseUniforms["diffuseSourceB"].value = dummyBlackMap;
  diffuseUniforms["diffuseSourceC"].value = dummyBlackMap;
}

// -----------------------------------------------------------------------------------

function animate() {
  requestAnimationFrame(animate);
  render();

  stats.update();
}

function render() {
  var delta = clock.getDelta();
  delta = Math.min(delta, 0.1);

  // update texture

  var pars = characterList[characterIndex];

  var zn = 20;

  var fi, fiNorm;
  var indexFloat_roll, indexN0_roll, indexN1_roll;
  var indexFloat_shift, indexN0_shift, indexN1_shift;
  var indexFloat_scroll, indexN0_scroll, indexN1_scroll;
  var ratioA, ratioB, ratioC;
  var strengthA, strengthB, strengthC, strengthABC;

  var diffuseMapsRoll = pars.diffuseMapsRoll;
  var diffuseMapsShift = pars.diffuseMapsShift;
  var diffuseMapsScroll = pars.diffuseMapsScroll;

  if (mixBehaviors) {
    if (behaviorTimer <= 0) {
      behavior = XG.Math.randomInt(1, 4);
      setBehavior(behavior);

      if (behavior === 2 || behavior === 3)
        behaviorTimer = XG.Math.randomFloat(
          parameters.bFwdMin,
          parameters.bFwdMin + parameters.bFwdDur
        );
      else if (behavior === 1)
        behaviorTimer = XG.Math.randomFloat(
          parameters.bFolMin,
          parameters.bFwdMin + parameters.bFolDur
        );
      else
        behaviorTimer = XG.Math.randomFloat(
          parameters.bRndMin,
          parameters.bRndMin + parameters.bRndDur
        );

      console.log("behavior", behavior);
    }

    behaviorTimer -= delta;

    parameters.behaviorTimer = behaviorTimer;
  }

  // eyes behaviors

  var eyesX = 0;
  var eyesY = 0;

  switch (behavior) {
    case 1:
      eyesX = parameters.eyeScaleX1 * mouseX;
      eyesY = parameters.eyeScaleY1 * mouseY;

      break;

    case 2:
      eyesX = parameters.eyeScaleX2 * mouseX;
      eyesY = parameters.eyeScaleY2 * mouseY;

      break;

    case 3:
      eyesX = parameters.eyeScaleX3 * mouseX;
      eyesY = parameters.eyeScaleY3 * mouseY;

      break;

    case 4:
      eyesX = parameters.eyeScaleX4 * mouseX;
      eyesY = parameters.eyeScaleY4 * mouseY;

      break;
  }

  if (behavior === 4) {
    if (eyeTargetTimer <= 0) {
      eyeTargetX =
        (0.5 - Math.random()) * window.innerWidth * parameters.targetScaleX;
      eyeTargetY =
        (0.5 - Math.random()) * window.innerHeight * parameters.targetScaleY;

      eyeTargetTimer = XG.Math.randomFloat(
        parameters.timerMin,
        parameters.timerMin + parameters.timerDur
      );
    }

    //eyesX = eyeTargetX;
    //eyesY = eyeTargetY;

    //eyesX = ( eyeTargetX + eyesX ) * 0.5;
    //eyesY = ( eyeTargetY + eyesY ) * 0.5;

    eyesX =
      eyesX * parameters.eyeTargetMix +
      eyeTargetX * (1.0 - parameters.eyeTargetMix);
    eyesY =
      eyesY * parameters.eyeTargetMix +
      eyeTargetY * (1.0 - parameters.eyeTargetMix);

    eyeTargetTimer -= delta;

    parameters.targetTimer = eyeTargetTimer;
  }

  var deltaEyes = delta * parameters.eyeVelocity;

  eyesX = lastEyesX + (eyesX - lastEyesX) * deltaEyes;
  eyesY = lastEyesY + (eyesY - lastEyesY) * deltaEyes;

  lastEyesX = eyesX;
  lastEyesY = eyesY;

  // eye sequences blending

  var dx = eyesX / SCREEN_WIDTH;
  var dy = eyesY / SCREEN_HEIGHT;

  var dd = Math.sqrt(dx * dx + dy * dy);

  var dShift = Math.abs(eyesY / window.innerHeight);
  var dScroll = Math.abs(eyesX / window.innerWidth);

  strengthA = dd;
  strengthB = 0.5 - dShift;
  strengthC = 0.5 - dScroll;

  strengthABC = strengthA + strengthB + strengthC;

  strengthA = strengthA / strengthABC;
  strengthB = strengthB / strengthABC;
  strengthC = strengthC / strengthABC;

  // roll

  fi = Math.atan2(eyesX, eyesY);
  fi += Math.PI;

  fiNorm = 0.5 * (fi / Math.PI);
  indexFloat_roll = fiNorm * (zn - 1);

  indexN0_roll = Math.floor(indexFloat_roll);
  ratioA = indexFloat_roll - indexN0_roll;

  indexN0_roll = (indexN0_roll + 5) % (zn - 1);
  indexN1_roll = (indexN0_roll + 1) % (zn - 1);

  // shift

  indexFloat_shift = (11 * eyesX) / SCREEN_WIDTH;
  if (indexFloat_shift < 0) indexFloat_shift = -indexFloat_shift + 10;

  indexN0_shift = Math.floor(indexFloat_shift);
  ratioB = indexFloat_shift - indexN0_shift;

  indexN1_shift = indexN0_shift + 1;

  // scroll

  indexFloat_scroll = (-9 * eyesY) / SCREEN_HEIGHT;
  if (indexFloat_scroll < 0) indexFloat_scroll = -indexFloat_scroll + 10;

  indexN0_scroll = Math.floor(indexFloat_scroll);
  ratioC = indexFloat_scroll - indexN0_scroll;

  indexN1_scroll = indexN0_scroll + 1;

  //console.log( indexN0 );

  diffuseUniforms["diffuseSourceA"].value = pars.rollSpritesMap;
  diffuseUniforms["diffuseSourceB"].value = pars.shiftSpritesMap;
  diffuseUniforms["diffuseSourceC"].value = pars.scrollSpritesMap;

  diffuseUniforms["indexA"].value.set(indexN0_roll, indexN1_roll);
  diffuseUniforms["indexB"].value.set(indexN0_shift, indexN1_shift);
  diffuseUniforms["indexC"].value.set(indexN0_scroll, indexN1_scroll);

  diffuseUniforms["maskSize"].value.set(pars.maskSize[0], pars.maskSize[1]);
  diffuseUniforms["maskBoundingBox"].value.set(
    pars.maskBoundingBox[0],
    pars.maskBoundingBox[1],
    pars.maskBoundingBox[2],
    pars.maskBoundingBox[3]
  );

  diffuseUniforms["highDiffuse"].value = pars.highMap;
  diffuseUniforms["highMask"].value = pars.highMaskMap;

  diffuseUniforms["ratioA"].value = XG.Math.clamp(ratioA, 0.0, 1.0);
  diffuseUniforms["ratioB"].value = XG.Math.clamp(ratioB, 0.0, 1.0);
  diffuseUniforms["ratioC"].value = XG.Math.clamp(ratioC, 0.0, 1.0);

  diffuseUniforms["strengthA"].value = XG.Math.clamp(strengthA, 0.0, 1.0);
  diffuseUniforms["strengthB"].value = XG.Math.clamp(strengthB, 0.0, 1.0);
  diffuseUniforms["strengthC"].value = XG.Math.clamp(strengthC, 0.0, 1.0);

  diffuseUniforms["gamma"].value = pars.gamma;
  diffuseUniforms["brightness"].value = pars.brightness;
  diffuseComposer.render(0.1);

  // post-fx

  if (useDeferred) {
    effectSharpen.enabled = pars.sharpen;
  }

  // head behaviors

  if (meshRoot) {
    var headSrcX = mouseX;
    var headSrcY = mouseY;

    var headX = 0.0;
    var headY = 0.0;

    switch (behavior) {
      case 1:
        headX = parameters.headScaleX1 * headSrcX;
        headY = parameters.headScaleY1 * headSrcY;

        break;

      case 2:
        headX = parameters.headScaleX2 * headSrcX;
        headY = parameters.headScaleY2 * headSrcY;

        break;

      case 3:
        headX = parameters.headScaleX3 * headSrcX;
        headY = parameters.headScaleY3 * headSrcY;

        break;

      case 4:
        headX = parameters.headScaleX4 * headSrcX;
        headY = parameters.headScaleY4 * headSrcY;

        headX =
          headX * parameters.headEyeMix + eyesX * (1.0 - parameters.headEyeMix);
        headY =
          headY * parameters.headEyeMix + eyesY * (1.0 - parameters.headEyeMix);

        break;
    }

    targetX = headX * 0.0002;
    targetY = headY * 0.0002;

    var deltaHead = delta * parameters.headVelocity;

    meshRoot.rotation.y += deltaHead * (targetX - meshRoot.rotation.y);
    meshRoot.rotation.x += deltaHead * (targetY - meshRoot.rotation.x);
  }

  // update camera

  camera.position.set(0, 0, 400);
  camera.lookAt(target);

  // render scene

  renderer.render(scene, camera);
}
