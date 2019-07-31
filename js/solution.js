'use strict';

const menu = document.querySelector('.menu');
const currentImage = document.querySelector('.current-image');
const menuItemNew = document.querySelector('.menu__item.new');
const commentsForm = document.querySelector('.comments__form');
let fileInput;

function init() {
  menu.dataset.state = 'initial';
  currentImage.style.display = 'none';
  commentsForm.style.display = 'none';
  const bounds = document.documentElement.getBoundingClientRect();
  menu.style.setProperty('--menu-top', `${bounds.bottom / 2 - menu.clientHeight / 2}px`);
  menu.style.setProperty('--menu-left', `${bounds.right / 2 - menu.clientWidth / 2}px`);
  
  fileInput = document.createElement('input');
  fileInput.setAttribute('type', 'file');
  fileInput.setAttribute('accept', 'image/jpeg, image/png');
  fileInput.addEventListener('change', e => {
    publicNewImage(e.currentTarget)
     .catch(error => console.error('Ошибка:', error))
     .then(res => {
       const {url} = res;
       currentImage.style.display = 'block';
       currentImage.src = url;
     });
  });
}

function publicNewImage(input) {
  const formData = new FormData();
  formData.append('title', input.files[0].name);
  formData.append('image', input.files[0]);

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