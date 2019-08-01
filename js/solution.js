'use strict';

const app = document.querySelector('.app');
const menu = document.querySelector('.menu');
const currentImage = document.querySelector('.current-image');
const menuItemNew = document.querySelector('.menu__item.new');
const commentsForm = document.querySelector('.comments__form');
const imageLoader = document.querySelector('.image-loader');
let fileInput;

function centerElement(el) {
  const bounds = document.documentElement.getBoundingClientRect();
  el.style.setProperty('--menu-top', `${bounds.bottom / 2 - menu.clientHeight / 2}px`);
  el.style.setProperty('--menu-left', `${bounds.right / 2 - menu.clientWidth / 2}px`);
}

function handleFileChange(e) {
  if (e.target.classList.contains('app') && e.target.dataset.state !== 'initial') {
    return;
  }
  const img = e.dataTransfer ? e.dataTransfer.files[0] : e.currentTarget.files[0];
  imageLoader.style.display = 'block';
  menu.style.display = 'none';
  
  publicNewImage(img)
   .catch(error => console.error('Ошибка:', error))
   .then(res => {
     currentImage.src = res.url;
     menu.dataset.state = 'default';
     menu.style.display = 'block';
     centerElement(menu);
     currentImage.style.display = 'block';
     imageLoader.style.display = 'none';
   });
}

function init() {
  menu.dataset.state = 'initial';
  currentImage.style.display = 'none';
  commentsForm.style.display = 'none';
  centerElement(menu);
  
  fileInput = document.createElement('input');
  fileInput.setAttribute('type', 'file');
  fileInput.setAttribute('accept', 'image/jpeg, image/png');
  fileInput.addEventListener('change', handleFileChange);

  app.addEventListener('dragover', e => e.preventDefault());
  app.addEventListener('drop', e => {
    e.preventDefault();
    handleFileChange(e);
  });
  console.log(app);
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

menuItemNew.addEventListener('click', e => {
  e.preventDefault();
  fileInput.click();
});

init();