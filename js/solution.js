'use strict';

//elements
const app = document.querySelector('.app');
const menu = document.querySelector('.menu');
const menuItemNew = document.querySelector('.menu__item.new');
const menuItemBurger = document.querySelector('.menu__item.burger');
const menuItemDrag = document.querySelector('.menu__item.drag');
const menuModeComments = document.querySelector('.mode.comments');
const menuModeDraw = document.querySelector('.mode.draw');
const menuModeShare = document.querySelector('.mode.share');
const currentImage = document.querySelector('.current-image');
const commentsForm = app.removeChild(app.querySelector('.comments__form')); //запись в переменную с удалением из разметки
const commentsLoader = commentsForm.querySelector('.loader').parentElement; //лоадер вместе с дивом-оберткой
const commentNode = commentsForm.querySelector('.comment');
const imageLoader = document.querySelector('.image-loader');
const error = document.querySelector('.error');
const menuUrl = document.querySelector('.menu__url');
const menuCopy = document.querySelector('.menu_copy');
const drawToolsList = document.querySelector('.draw-tools');

//state
let fileInput = null; //инпут для изображения
let imgId = new URLSearchParams(window.location.search).get('imgIdFromUrl') || null; //получаем из урла id для "поделиться"
let commonDataWrapper = null;
let mask = null;
let state = sessionStorage.getItem('state') || 'initial';
let ws = null;
let timer = performance.now();
const MARKER_WIDTH_ADJUSTMENT = 21; //поправка на 3/4 ширины маркера

//внешний вид в зависимости от состояния
menu.dataset.state = state;

if (state === 'initial') {
  currentImage.style.display = 'none';
  menuItemBurger.style.display = 'none';
  centerElement(menu); //центрируем меню
} else {
  currentImage.style.display = 'block';
}

currentImage.src = sessionStorage.getItem('currentImgSrc') || '';


//загрузка изображения
fileInput = fileInput || document.createElement('input');
fileInput.setAttribute('type', 'file');
fileInput.setAttribute('accept', 'image/jpeg, image/png');
fileInput.addEventListener('change', handleFileChange);

app.addEventListener('dragover', e => e.preventDefault());
app.addEventListener('drop', e => {
  e.preventDefault();
  handleFileChange(e);
});

//wrapper для маски, канваса и комментариев
const wrap = document.createElement('div');
wrap.classList.add('commonDataWrapper');
wrap.style.position = 'absolute';
wrap.style.top = '50%';
wrap.style.left = '50%';
wrap.style.transform = 'translate(-50%, -50%)';
app.insertBefore(wrap, error);
commonDataWrapper = document.querySelector('.commonDataWrapper');


//добавление маски в разметку
addMask();

//добавление данных изображения из id адресной строки
if (imgId) {
  getImageInfo(imgId)
    .catch(error => showErr(error))
    .then(res => {
      applyImg(res);
      switchMenuMode(menuModeComments);
      openWS(res.id);
    });
}

initMovedMenu();

//canvas
addCanvas();
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

const BRUSH_RADIUS = 4;
let touches = [];
let drawing = false;
let needsRepaint = false;

function circle(point, color) {
  ctx.beginPath();
  ctx.fillStyle = color;
  ctx.arc(...point, BRUSH_RADIUS / 2, 0, 2 * Math.PI);
  ctx.fill();
}

function smoothCurve(points, color) {
  ctx.beginPath();
  ctx.strokeStyle = color;
  ctx.lineWidth = BRUSH_RADIUS;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  ctx.moveTo(...points[0]);

  for (let i = 1; i < points.length - 1; i++) {
    ctx.lineTo(...points[i]);
    // smoothCurveBetween(points[i], points[i + 1]); //можно сделать линию более плавной с помощью доп. функции вместо lineTo
  }

  ctx.stroke();
}

function getColor() {
  const colorName = drawToolsList.querySelector('input[type = radio]:checked').value;
  let color;
  
  switch (colorName) {
    case 'red':
      color = '#ea5d56';
      break;
    case 'yellow':
      color = '#f3d135';
      break;
    case 'green':
      color = '#6cbe47';
      break;
    case 'blue':
      color = '#53a7f5';
      break;
    case 'purple':
      color = '#b36ade';
      break;
  }

  return color;
}

function repaint() {

  touches
    .forEach((touch) => {
      touch.points.forEach(point => {
        circle(point, touch.color);
      });

      smoothCurve(touch.points, touch.color);
    });
}

canvas.addEventListener('mousedown', e => {
  if (menuModeDraw.dataset.state === 'selected') {
    drawing = true;
    const touch = {
      color: getColor(),
      points: []
    };
    touch.points.push([e.offsetX, e.offsetY]);
    touches.push(touch);
    needsRepaint = true;
  }
});

canvas.addEventListener('mouseup', e => {
  if (menuModeDraw.dataset.state === 'selected') {
    drawing = false;
    needsRepaint = true;

    //отправка на сервер
    const now = performance.now();
    //если прошло более 1 секунды с момента отправки штрихов на сервер, отправляем
    if (now - timer > 1000) {
      //отправка маски на сервер
      canvas.toBlob(blob => ws.send(blob));
      timer = now; //перезаписываем таймер
    }
  }
});

canvas.addEventListener('mousemove', e => {
  if (menuModeDraw.dataset.state === 'selected') {
    if (drawing) {
      const point = [e.offsetX, e.offsetY];
      touches[touches.length - 1].points.push(point);
      needsRepaint = true;
    }
  }
});

function tick() {
  if (needsRepaint) {
    repaint();
    needsRepaint = false;
  }

  window.requestAnimationFrame(tick);
}

tick();


//функции

function centerElement(el) {
  const bounds = document.documentElement.getBoundingClientRect();
  el.style.setProperty('--menu-top', `${bounds.bottom / 2 - menu.clientHeight / 2}px`);
  el.style.setProperty('--menu-left', `${bounds.right / 2 - menu.clientWidth / 2}px`);
}

function showErr(msg) {
  const currentErr = error.cloneNode(true);

  if (msg) {
    const currentMsg = currentErr.querySelector('.error__message');
    currentMsg.innerText = msg;
  }
  error.parentElement.insertBefore(currentErr, error);
  currentErr.style.display = 'block';
  currentErr.style.zIndex = 2;
}

function hideErrors() {
  const errors = document.querySelectorAll('.error');
  [...errors].forEach(error => error.style.display = 'none');
}

//обработка загрузки нового изображения
function handleFileChange(e) {
  hideErrors();

  if (e.currentTarget.dataset.state && e.currentTarget.dataset.state !== 'initial') {
    showErr('Чтобы загрузить новое изображение, пожалуйста, воспользуйтесь пунктом "Загрузить новое" в меню.');
    return;
  }

  const img = e.dataTransfer ? e.dataTransfer.files[0] : e.currentTarget.files[0];

  if (!(img.type === "image/jpeg" || img.type === "image/png")) {
    showErr();
    return;
  }

  imageLoader.style.display = 'block';
  menu.style.display = 'none';

  publicNewImage(img)
    .catch(error => console.error('Ошибка:', error))
    .then(res => {
      mask.style.display = 'none'; //прячем маску
      applyImg(res);
      switchMenuMode(menuModeShare);
      history.pushState({}, null, createShareUrl(res.id)); //дописываем id в параметр url без перезагрузки страницы для удобного шаринга
      openWS(res.id);
    });
}

//формирование url для "поделиться"
function createShareUrl(id) {
  const currentUrl = window.location.href.split('?')[0];
  return `${currentUrl}?imgIdFromUrl=${id}`;
}

//публикация изображения на сервере, возвращает инфо
function publicNewImage(img) {
  const formData = new FormData();
  formData.append('title', img.name);
  formData.append('image', img);

  return fetch('https://neto-api.herokuapp.com/pic', {
      method: 'POST',
      body: formData,
    })
    .then(res => res.json())
}

//получение информации об изображении с сервера
function getImageInfo(id) {
  return fetch(`https://neto-api.herokuapp.com/pic/${id}`, {
      method: 'GET'
    })
    .catch(error => console.error('Ошибка:', error))
    .then(res => res.json());
}

//отправка комментария на сервер
function publicNewComment(id, message, left, top) {
  // const formData = {message, left, top}
  const formData = 'message=' + encodeURIComponent(message) +
    '&left=' + encodeURIComponent(left) +
    '&top=' + encodeURIComponent(top);

  //отправить через websocket
  ws.send(JSON.stringify({
    "event": "comment",
    "comment": {
      "left": left,
      "message": message,
      "timestamp": Date.now(),
      "top": top
    }
  }));

  //отправить через fetch
  return fetch(`https://neto-api.herokuapp.com/pic/${id}/comments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData
    })
    .catch(err => console.error('Ошибка:', err))
    .then(res => res.json());
}

//добавление полученного с сервера изображения в UI
function applyImg(res) {
  imgId = res.id;
  currentImage.src = res.url;
  sessionStorage.setItem('currentImgSrc', res.url);
  menuUrl.value = createShareUrl(imgId);
  currentImage.style.display = 'block';
  imageLoader.style.display = 'none';
  menu.style.display = 'block';

  //switch state
  app.dataset.state = 'default';
  sessionStorage.setItem('state', 'default');

  //удаляем все комментарии из разметки
  [...document.querySelectorAll('.comments__form')].forEach(commentForm => {
    commentForm.remove();
  });

  //обновляем маску
  if (res.mask) {
    mask.src = res.mask;
    mask.style.display = 'block';
  }

  //в момент загрузки изображения устанавливаем размер маски и canvas
  currentImage.addEventListener('load', e => {
    commonDataWrapper.style.width = `${currentImage.width}px`;
    commonDataWrapper.style.height = `${currentImage.height}px`;  
    mask.width = canvas.width = currentImage.width;
    mask.height = canvas.height = currentImage.height;
    applyComments(res.comments); //только после полной загрузки изображения добавляем комментарии на страницу
  });
}

function switchMenuMode(modeNode) {
  menuItemNew.style.display = 'none';
  menu.dataset.state = 'selected';
  menuItemBurger.style.display = 'inline-block';
  modeNode.dataset.state = 'selected';
}

menuItemNew.addEventListener('click', e => fileInput.click());

menuItemBurger.addEventListener('click', e => {
  e.currentTarget.parentElement.dataset.state = 'default';
  e.currentTarget.style.display = 'none';
  [menuModeComments, menuModeDraw, menuModeShare].forEach(li => li.dataset.state = '');
  menuItemNew.style.display = 'inline-block';
});

[menuModeComments, menuModeDraw, menuModeShare].forEach(li =>
  li.addEventListener('click', e => switchMenuMode(e.currentTarget))
);

menuCopy.addEventListener('click', () => navigator.clipboard.writeText(menuUrl.value));

function initMovedMenu() {
  let movedMenu;

  document.addEventListener('mousedown', e => {
    if (e.target.classList.contains('drag')) {
      movedMenu = e.target.parentElement;
    }
  });

  document.addEventListener('mouseup', e => {
    movedMenu = null;
  });

  document.addEventListener('mousemove', e => {
    if (movedMenu) {
      let leftGap = menuItemDrag.offsetWidth / 2;
      let rigthGap = menu.clientWidth - leftGap;
      let gapY = menuItemDrag.offsetHeight / 2;
      let rightBound = document.documentElement.clientWidth;
      let bottomBound = document.documentElement.clientHeight;
      let x, y;
      if (e.clientY <= gapY) {
        y = 0;
      } else if (e.clientY >= bottomBound - gapY) {
        y = bottomBound - gapY * 2;
      } else {
        y = e.clientY - gapY;
      }

      if (e.clientX <= leftGap) {
        x = 0;
      } else if (e.clientX >= rightBound - rigthGap - leftGap / 2) {
        x = rightBound - rigthGap - leftGap - leftGap / 2;
      } else {
        x = e.clientX - leftGap;
      }

      movedMenu.style.left = `${x}px`;
      movedMenu.style.top = `${y}px`;
    }
  });
}

//Добавление комментария
app.addEventListener('click', e => {

  if (menuModeComments.dataset.state !== 'selected' || e.target.id !== 'canvas') {
    return;
  };

  //скрыть все остальные комментарии
  [...document.querySelectorAll('.comments__form')].forEach(commentForm => {
    if (commentForm.querySelector('.comment')) {
      commentForm.querySelector('.comments__marker-checkbox').checked = false;
    } else {
      //или удалить форму, если ни одного комментария нет
      commentForm.remove();
    }
  });

  const newComment = commentsForm.cloneNode(true);
  newComment.style.zIndex = 4; //добавляем поверх канваса, чтобы нормально обрабатывались клики по комментариям
  [...newComment.querySelectorAll('.comment')].forEach(comment => comment.parentElement.removeChild(comment)); //удаляем все комментарии-примеры
  commonDataWrapper.appendChild(newComment);
  newComment.style.display = 'block';
  const marker = newComment.firstElementChild;
  const currentImageBounds = currentImage.getBoundingClientRect();
  const markerLeft = e.clientX - Math.round(currentImageBounds.left) - MARKER_WIDTH_ADJUSTMENT;
  const markerTop = e.clientY - Math.round(currentImageBounds.top);
  newComment.dataset.left = markerLeft;
  newComment.dataset.top = markerTop;
  newComment.style.left = `${markerLeft}px`;
  newComment.style.top = `${markerTop}px`;

  marker.nextSibling.checked = true; //отобразить форму добавления комментария 
  marker.nextSibling.setAttribute('disabled', ''); //отключить скрытие формы по клику на маркер
})

//добавление комментариев в UI
function applyComments(comments) {

  for (const commentKey in comments) {
    //пропустить, если такой комментарий существует
    if (document.querySelector(`[data-id = '${commentKey}']`)) {
      continue;
    };

    const comment = comments[commentKey];

    //создаем отдельный коммент
    const currentCommentNode = commentNode.cloneNode(true);
    currentCommentNode.lastElementChild.innerText = comment.message;
    currentCommentNode.dataset.id = commentKey;
    currentCommentNode.firstElementChild.innerText = new Date(comment.timestamp)
      .toLocaleString("ru", {
        year: "2-digit",
        month: "numeric",
        day: "numeric",
        hour: "numeric",
        minute: "numeric",
        second: "numeric"
      })
      .split(',').join('');

    //Форма с комментариями
    let currentCommentsForm = null;

    [...document.querySelectorAll('.comments__form')].forEach(group => {
      if (parseInt(group.dataset.top) === comment.top &&
        parseInt(group.dataset.left) === comment.left) {
        currentCommentsForm = group;
      }
    });

    //создаем форму, если точки для этого комментария еще нет
    if (!currentCommentsForm) {
      currentCommentsForm = commentsForm.cloneNode(true);
      currentCommentsForm.style.zIndex = 4; //форма для комментария поверх канваса, чтобы отслеживать клики

      [...currentCommentsForm.querySelectorAll('.comment')]
      .forEach(comment => comment.parentElement.removeChild(comment)); //удаляем все комментарии


      commonDataWrapper.appendChild(currentCommentsForm);
      currentCommentsForm.style.display = 'block';
      currentCommentsForm.dataset.left = comment.left;
      currentCommentsForm.dataset.top = comment.top;
      currentCommentsForm.style.left = `${comment.left}px`;
      currentCommentsForm.style.top = `${comment.top}px`;
    }

    //добавляем комментарий в форму
    const currentCommentsBody = currentCommentsForm.querySelector('.comments__body');
    currentCommentsBody.insertBefore(currentCommentNode, currentCommentsBody.lastElementChild.previousElementSibling.previousElementSibling);
  };
};

//Скрыть-показать комментарии
[...document.querySelectorAll('.menu__toggle')].forEach(toggle => {
  toggle.addEventListener('change', e => {
    if (e.currentTarget.checked) {
      if (e.currentTarget.id === 'comments-on') {
        [...app.querySelectorAll('.comments__form')]
        .forEach(commentForm => commentForm.style.display = 'block');
      }
      if (e.currentTarget.id === 'comments-off') {
        [...app.querySelectorAll('.comments__form')]
        .forEach(commentForm => commentForm.style.display = 'none');
      }
    }
  });
});

//События для комментариев
//close
app.addEventListener('click', e => {
  if (e.target.classList.contains('comments__close')) {
    e.preventDefault();
    const currentComment = e.target.parentElement.parentElement;

    if (currentComment.querySelector('.comment')) { //если текущая форма для комментариев уже содержит хотя бы один комментарий
      currentComment.querySelector('.comments__marker-checkbox').checked = false; //выключаем чекбокс
    } else {
      const currentComment = e.target.parentElement.parentElement;
      commonDataWrapper.removeChild(currentComment); //иначе полностью удаляем комментарий из разметки
    }
  }
});

//submit
app.addEventListener('click', e => {
  if (e.target.classList.contains('comments__submit')) {
    e.preventDefault();
    const currentComment = e.target.parentElement.parentElement;
    const textInput = e.target.previousElementSibling.previousElementSibling;
    currentComment.querySelector('.comments__marker-checkbox').removeAttribute('disabled'); //включить скрытие формы по клику на маркер
    const message = textInput.value;
    textInput.value = ''; //обнуляем инпут комментария
    const left = currentComment.dataset.left;
    const top = currentComment.dataset.top;
    const currentLoader = currentComment.querySelector('.comments__body').insertBefore(commentsLoader.cloneNode(true), textInput);

    publicNewComment(imgId, message, left, top)
      .then(res => {
        updateCommentForm(res, currentComment, currentLoader, left, top);
        //здесь вызываем функцию "обновить форму комментария", в которой обновляем только комменты в этой точке
      });
  }
});

//скрываем остальные комментарии при показе комментария
app.addEventListener('change', e => {
  if (e.target.classList.contains('comments__marker-checkbox')) {
    if (e.target.checked) {
      [...document.querySelectorAll('.comments__marker-checkbox')].forEach(input => {
        if (input.parentElement.querySelector('.comment')) {
          input.checked = false;
          input.parentElement.style.zIndex = 3;
        } else {
          //если в форме нет комментариев, удаляем из разметки
          input.parentElement.remove();
        }
      });
      e.target.checked = true;
      e.target.parentElement.style.zIndex = 4;
    }
  }
});

//нужно немного доработать функцию applyComments и удалить эту!
function updateCommentForm(res, currentCommentForm, currentLoader, left, top) {
  const currentCommentsBody = currentCommentForm.querySelector('.comments__body');
  currentCommentsBody.removeChild(currentLoader);

  [...currentCommentForm.querySelectorAll('.comment')]
  .forEach(comment => comment.parentElement.removeChild(comment)); //удаляем все комментарии

  for (const commentKey in res.comments) {
    const comment = res.comments[commentKey];
    if (parseInt(left) === comment.left &&
      parseInt(top) === comment.top) {
      const currentCommentNode = commentNode.cloneNode(true);
      currentCommentNode.lastElementChild.innerText = comment.message;
      currentCommentNode.firstElementChild.innerText = new Date(comment.timestamp)
        .toLocaleString("ru", {
          year: "2-digit",
          month: "numeric",
          day: "numeric",
          hour: "numeric",
          minute: "numeric",
          second: "numeric"
        })
        .split(',').join('');
      currentCommentsBody.insertBefore(currentCommentNode, currentCommentsBody.lastElementChild.previousElementSibling.previousElementSibling);
    }
  };

}

//Canvas

function addCanvas() {
  const canvas = document.createElement('canvas');
  canvas.setAttribute('width', app.clientWidth);
  canvas.setAttribute('height', app.clientHeight);
  canvas.id = 'canvas';
  canvas.style.position = 'absolute';
  canvas.style.zIndex = 2;
  canvas.style.top = '50%';
  canvas.style.left = '50%';
  canvas.style.transform = 'translate(-50%, -50%)';

  commonDataWrapper.appendChild(canvas);
}

function addMask() {
  const maskTag = document.createElement('img');
  maskTag.classList.add('mask');
  maskTag.style.display = 'none'; //по умолчанию прячем маску

  //центрируем маску
  maskTag.style.top = '50%';
  maskTag.style.left = '50%';
  maskTag.style.transform = 'translate(-50%, -50%)';

  maskTag.style.position = 'absolute';
  maskTag.style.zIndex = 1;

  commonDataWrapper.appendChild(maskTag);
  mask = document.querySelector('.mask');
}

//websocket

function openWS(id) {
  ws = new WebSocket(`wss://neto-api.herokuapp.com/pic/${id}`);
  ws.addEventListener('message', evt => {
    const data = JSON.parse(evt.data);
    if (data.event === 'mask') {
      mask.src = data.url;
      mask.style.display = 'block';
      
      //после загрузки маски можно удалить штрихи, которые мы храним в state приложения и очистить холст
      mask.addEventListener('load', e => {
        if (!drawing) {
          touches.length = 0; //если текущий пользователь не рисует, полностью очищаем штрихи, т.к. актуальный рисунок уже на сервере
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          return;
        }
        //если рисование продолжается, очищаем все штрихи, кроме последнего ??
        touches = touches.slice(touches.length - 1);
      });
    }

    if (data.event === 'comment') {
      const comment = data.comment;
      const id = data.comment.id;
      applyComments({
        [id]: comment
      });
    }

    if (data.event === 'error') {
      showErr(data.message);
    }
  });

  ws.addEventListener('close', e => {
    if (e.code !== 1000) {
      //переоткрываем соединение в случае обрыва связи
      openWS(imgId);
    }
  });
}