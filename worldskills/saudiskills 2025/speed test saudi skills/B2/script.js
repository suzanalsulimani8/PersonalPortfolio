// Get references to DOM elements
const colorBox = document.getElementById('color-box');
const rgbValueText = document.getElementById('rgb-value');
const redSlider = document.getElementById('red');
const greenSlider = document.getElementById('green');
const blueSlider = document.getElementById('blue');

// Update the color box and RGB value
const updateColor = () => {
    const red = redSlider.value;
    const green = greenSlider.value;
    const blue = blueSlider.value;

    // Update the background color
    const rgbColor = `rgb(${red}, ${green}, ${blue})`;
    colorBox.style.backgroundColor = rgbColor;

    // Update the RGB value text
    rgbValueText.textContent = rgbColor;
};

// Attach event listeners to sliders
redSlider.addEventListener('input', updateColor);
greenSlider.addEventListener('input', updateColor);
blueSlider.addEventListener('input', updateColor);