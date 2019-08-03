'use strict';

const app = document.querySelector('.app');
const menu = document.querySelector('.menu');
const menuItemNew = document.querySelector('.menu__item.new');
const menuItemBurger = document.querySelector('.menu__item.burger');
const menuItemDrag = document.querySelector('.menu__item.drag');
const menuModeComments = document.querySelector('.mode.comments');
const menuModeDraw = document.querySelector('.mode.draw');
const menuModeShare = document.querySelector('.mode.share');
const currentImage = document.querySelector('.current-image');
const commentsForm = document.querySelector('.comments__form');
const imageLoader = document.querySelector('.image-loader');
const error = document.querySelector('.error');
const menuUrl = document.querySelector('.menu__url');
const menuCopy = document.querySelector('.menu_copy');

let fileInput;

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
      switchMenuMode(menuModeShare);
      history.pushState({}, null, createShareUrl(res.id)); //дописываем id в параметр url без перезагрузки страницы для удобного шаринга
   });
}

//формирование url для "поделиться"
function createShareUrl(id) {
  const currentUrl = window.location.href.split('?')[0];
  return `${currentUrl}?imgIdFromUrl=${id}`;
}


function init() {
  const imgIdFromUrl = new URLSearchParams(window.location.search).get('imgIdFromUrl'); //получаем из урла id для "поделиться"
  menu.dataset.state = sessionStorage.getItem('state') || 'initial';
  commentsForm.style.display = 'none';
  currentImage.style.display = 'none';
  menuItemBurger.style.display = 'none';
  centerElement(menu);

  if(sessionStorage.getItem('state')) {
    currentImage.style.display = 'block';
  }

  if(sessionStorage.getItem('currentImgSrc')) {
    currentImage.src = sessionStorage.getItem('currentImgSrc');
  }
  
  fileInput = fileInput || document.createElement('input');
  fileInput.setAttribute('type', 'file');
  fileInput.setAttribute('accept', 'image/jpeg, image/png');
  fileInput.addEventListener('change', handleFileChange);

  app.addEventListener('dragover', e => e.preventDefault());
  app.addEventListener('drop', e => {
    e.preventDefault();
    handleFileChange(e);
  });

  if (imgIdFromUrl) {
    getImageInfo(imgIdFromUrl)
    .catch(error => console.error('Ошибка:', error))
    .then(res => {
       applyImg(res);
       switchMenuMode(menuModeComments);
    });
  }

  initMovedMenu();
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

//добавление полученного с сервера изображения в UI
function applyImg(res) {
  currentImage.src = res.url;
  sessionStorage.setItem('currentImgSrc', res.url);
  menuUrl.value = createShareUrl(res.id);
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

init();