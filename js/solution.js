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
     currentImage.src = res.url;
     sessionStorage.setItem('currentImgSrc', res.url);
     menu.dataset.state = 'selected';
     menuItemBurger.style.display = 'inline-block';
     menuModeShare.dataset.state = 'selected';
     app.dataset.state = 'default';
     sessionStorage.setItem('state', 'default');
     menu.style.display = 'block';
     currentImage.style.display = 'block';
     imageLoader.style.display = 'none';
     menuItemNew.style.display = 'none';
   });
}

function init() {
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
}

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

menuItemNew.addEventListener('click', e => fileInput.click());

menuItemBurger.addEventListener('click', e => {
  e.currentTarget.parentElement.dataset.state = 'default';
  [menuModeComments, menuModeDraw, menuModeShare].forEach(li => li.dataset.state = '');
  menuItemNew.style.display = 'inline-block';
});

[menuModeComments, menuModeDraw, menuModeShare].forEach(li => 
  li.addEventListener('click', e => {
    menu.dataset.state = 'selected';
    e.currentTarget.dataset.state = 'selected';
    menuItemNew.style.display = 'none';
    menuItemBurger.style.display = 'inline-block';
  })
);

init();