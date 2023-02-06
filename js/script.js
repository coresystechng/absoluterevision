const testimonialsContainer = document.querySelector('.testimonials-container');
const testimonials = testimonialsContainer.querySelectorAll('.testimonial');
const prevBtn = testimonialsContainer.querySelector('.prev');
const nextBtn = testimonialsContainer.querySelector('.next');

let currentIndex = 0;

testimonials[currentIndex].classList.add('active');

const slideInterval = setInterval(function() {
  testimonials[currentIndex].classList.remove('active');
  currentIndex++;
  if (currentIndex >= testimonials.length) {
    currentIndex = 0;
  }
  testimonials[currentIndex].classList.add('active');
}, 7000);

prevBtn.addEventListener('click', function() {
  clearInterval(slideInterval);
  testimonials[currentIndex].classList.remove('active');
  currentIndex--;
  if (currentIndex < 0) {
    currentIndex = testimonials.length - 1;
  }
  testimonials[currentIndex].classList.add('active');
});

nextBtn.addEventListener('click', function() {
  clearInterval(slideInterval);
  testimonials[currentIndex].classList.remove('active');
  currentIndex++;
  if (currentIndex >= testimonials.length) {
    currentIndex = 0;
  }
  testimonials[currentIndex].classList.add('active');
});
