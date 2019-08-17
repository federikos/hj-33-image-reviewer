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

//state приложения
let fileInput = null; //инпут для изображения
let imgId = null;
let mask = null;
const imgIdFromUrl = new URLSearchParams(window.location.search).get('imgIdFromUrl'); //получаем из урла id для "поделиться"
let state = sessionStorage.getItem('state') || 'initial';

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

//маска
addMask();
mask = document.querySelector('.mask');

//добавление данных изображения из id адресной строки
if (imgIdFromUrl) {
  getImageInfo(imgIdFromUrl)
  .catch(error => console.error('Ошибка:', error))
  .then(res => {
     applyImg(res);
     mask.src = res.mask || '';
     applyComments(res);
     switchMenuMode(menuModeComments);
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

  for(let i = 1; i < points.length - 1; i++) {
    ctx.lineTo(...points[i]);
    // smoothCurveBetween(points[i], points[i + 1]);
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

function repaint () {
  // clear before repainting
  ctx.clearRect(0, 0, canvas.width, canvas.height);

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
    const touch = {color: getColor(), points: []};
    touch.points.push([e.offsetX, e.offsetY]);
    touches.push(touch);
    needsRepaint = true;
  }
});

canvas.addEventListener('mouseup', e => {
  if (menuModeDraw.dataset.state === 'selected') {
    drawing = false;
    needsRepaint = true;
    console.log(touches);
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

function tick () {
  if(needsRepaint) {
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

  if(msg) {
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
  
  if(!(img.type === "image/jpeg" || img.type === "image/png")) {
    showErr();
    return;
  }

  imageLoader.style.display = 'block';
  menu.style.display = 'none';
  
  publicNewImage(img)
   .catch(error => console.error('Ошибка:', error))
   .then(res => {
      applyImg(res);
      applyComments(res);
      switchMenuMode(menuModeShare);
      history.pushState({}, null, createShareUrl(res.id)); //дописываем id в параметр url без перезагрузки страницы для удобного шаринга
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
    if(e.target.classList.contains('drag')) {
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
      if(e.clientY <= gapY) {
        y = 0;
      } else if(e.clientY >= bottomBound - gapY) {
        y = bottomBound - gapY * 2;
      } else {
        y = e.clientY - gapY;
      }

      if(e.clientX <= leftGap) {
        x = 0;
      } else if(e.clientX >= rightBound - rigthGap - leftGap / 2) {
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
  newComment.style.zIndex = 3; //добавляем поверх канваса, чтобы нормально обрабатывались клики по комментариям
  [...newComment.querySelectorAll('.comment')].forEach(comment => comment.parentElement.removeChild(comment)); //удаляем все комментарии-примеры
  app.appendChild(newComment);
  console.log(newComment);
  newComment.style.display = 'block';
  const marker = newComment.firstElementChild;
  const markerLeft = e.clientX - marker.offsetWidth / 2;
  const markerTop = e.clientY;
  newComment.style.left = `${markerLeft}px`;
  newComment.style.top = `${markerTop}px`;

  marker.nextSibling.checked = true; //отобразить форму добавления комментария 
  marker.nextSibling.setAttribute('disabled', ''); //отключить скрытие формы по клику на маркер
})

//добавление полученных с сервера комментариев в UI
function applyComments(res) {
  
  const sortedComments = [
    // {top, left, comments: []},
  ];

  for(const commentKey in res.comments) {
    const comment = res.comments[commentKey];
    let isPositionFound = false;
    sortedComments.forEach(group => {
      if (group.top === comment.top
        && group.left === comment.left) {
          group.comments.push(comment);
          isPositionFound = true;
        }
    });

    if (!isPositionFound) {
      sortedComments.push({top: comment.top, left: comment.left, comments: [comment]});
    }
  };

  for (const commentsGroup of sortedComments) {
    const currentCommentsForm = commentsForm.cloneNode(true);
    currentCommentsForm.style.zIndex = 3; //форма для комментария поверх канваса, чтобы отслеживать клики
    const currentCommentsBody = currentCommentsForm.querySelector('.comments__body');
    // currentCommentsBody.removeChild(currentLoader);
  
    [...currentCommentsForm.querySelectorAll('.comment')]
      .forEach(comment => comment.parentElement.removeChild(comment)); //удаляем все комментарии
    
    for (const comment of commentsGroup.comments) { //этот код частично повторяется в функции updateCommentForm, нужно вынести в отдельную функцию
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
    app.appendChild(currentCommentsForm);
    currentCommentsForm.style.display = 'block';
    currentCommentsForm.style.left = `${commentsGroup.left}px`;
    currentCommentsForm.style.top = `${commentsGroup.top}px`;
  }
}

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
    app.removeChild(currentComment); //иначе полностью удаляем комментарий из разметки
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
    const bounds  = currentComment.getBoundingClientRect();
    const currentLoader = currentComment.querySelector('.comments__body').insertBefore(commentsLoader.cloneNode(true), textInput);

    publicNewComment(imgId, message, bounds.left, bounds.top)
    .then(res => {
      updateCommentForm(res, currentComment, currentLoader, bounds.left, bounds.top);
      //здесь вызываем функцию "обновить форму комментария", в которой обновляем только комменты в этой точке
    });
  }
});

//скрываем остальные комментарии при показе комментария
app.addEventListener('change', e => {
  if(e.target.classList.contains('comments__marker-checkbox')) {
    if (e.target.checked) {
      [...document.querySelectorAll('.comments__marker-checkbox')].forEach(input => input.checked = false);
      e.target.checked = true;
    }
  }
});

function updateCommentForm(res, currentCommentForm, currentLoader, left, top) {
  const currentCommentsBody = currentCommentForm.querySelector('.comments__body');
  currentCommentsBody.removeChild(currentLoader);

  [...currentCommentForm.querySelectorAll('.comment')]
    .forEach(comment => comment.parentElement.removeChild(comment)); //удаляем все комментарии

  for(const commentKey in res.comments) {
    const comment = res.comments[commentKey];
    if (left === comment.left 
        && top === comment.top) {
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
  canvas.style.position = 'relative';
  canvas.style.zIndex = 2;

  app.insertBefore(canvas, currentImage);
}

function addMask() {
  const mask = document.createElement('img');
  mask.classList.add('mask');
  mask.style.display = 'block';

  //центрируем маску
  mask.style.top = '50%';
  mask.style.left = '50%';
  mask.style.transform = 'translate(-50%, -50%)';

  mask.style.position = 'absolute';
  mask.style.zIndex = 1;

  app.insertBefore(mask, currentImage);
}