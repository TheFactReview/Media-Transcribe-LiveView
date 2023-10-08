const mediaContainer = document.getElementById('media-container');
const video = document.getElementById('media');
const audio = document.getElementById('audio');
const textContainer = document.getElementById('text-container');
const dropZoneMedia = document.getElementById('drop-zone-media');
const dropZoneSubtitle = document.getElementById('drop-zone-subtitle');

const divider = document.querySelector('main .divider');

divider.addEventListener('mousedown', (downEvent) => {
    downEvent.preventDefault();
    const container = document.querySelector('main');
  
    function _moveListener(e) {
        e.preventDefault();
        const mouseXInContainer = e.clientX - container.offsetLeft;
        const perc = (mouseXInContainer / container.offsetWidth) * 100;
        
        const sections = container.querySelectorAll('section');
        sections[0].style.flexBasis = perc + '%';
        sections[1].style.flexBasis = (100 - perc) + '%';
    }

    function _upListener(e) {
        e.preventDefault();
        container.removeEventListener('mousemove', _moveListener);
        document.removeEventListener('mouseup', _upListener);
    }

    container.addEventListener('mousemove', _moveListener);
    document.addEventListener('mouseup', _upListener);
});

function handleMouseMove(e) {
    if (!isResizing) return;
    
    const newMediaContainerWidth = e.clientX;
    mediaContainer.style.width = `${newMediaContainerWidth}px`;
    textContainer.style.width = `calc(100% - ${newMediaContainerWidth}px - 10px)`;
}

['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    dropZoneMedia.addEventListener(eventName, preventDefaults, false);
    dropZoneSubtitle.addEventListener(eventName, preventDefaults, false);
});

dropZoneMedia.addEventListener('drop', handleMediaDrop, false);
dropZoneMedia.addEventListener('click', createMediaInput);

dropZoneSubtitle.addEventListener('drop', handleSubtitleDrop, false);
dropZoneSubtitle.addEventListener('click', createSubtitleInput);

function createMediaInput() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'audio/*, video/*';
    input.addEventListener('change', handleMediaFile);
    input.click();
}

function createSubtitleInput() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.srt, .txt';
    input.addEventListener('change', handleSubtitleFile);
    input.click();
}

function handleMediaDrop(e) {
    const file = e.dataTransfer.files[0];
    handleMediaFile({ target: { files: [file] } });
}

function handleSubtitleDrop(e) {
    const file = e.dataTransfer.files[0];
    handleSubtitleFile({ target: { files: [file] } });
}

function handleMediaFile(event) {
    const file = event.target.files[0];
    const type = file.type.split('/')[0];
    
    if (type === 'audio') {
        audio.src = URL.createObjectURL(file);
        audio.style.display = 'block';
        video.style.display = 'none';
    } else if (type === 'video') {
        video.src = URL.createObjectURL(file);
        video.style.display = 'block';
        audio.style.display = 'none';
    }
}


function handleSubtitleFile(event) {
    const file = event.target.files[0];
    const reader = new FileReader();
    
    reader.onload = () => {
        const content = reader.result.trim();
        let subtitles;

        // Remove existing subtitles
        textContainer.innerHTML = '';
        
        if (content.includes('-->')) {
            // SRT format
            subtitles = content.split('\n\n').map(sub => {
                const parts = sub.split('\n');
                if (parts.length < 2) return null;
                const [_,time, ...lines] = parts;
                const [start, end] = time.split(' --> ');
                return {
                    start: parseTime(start),
                    end: parseTime(end),
                    text: lines.join('\n'),
                };
            }).filter(sub => sub !== null);
        } else {
            // Hugging Face Whisper Jax format
            subtitles = content.split('\n').map(sub => {
                const match = sub.match(/\[(\d{2}:\d{2}\.\d{3}) -> (\d{2}:\d{2}\.\d{3})\] (.+)/);
                if (!match) return null;
                
                const formatTime = time => {
                    time = time.replace('.', ','); // replace the dot with a comma
                    // if there is only one colon, prepend "00:" to the time
                    return time.includes(':') && time.indexOf(':') === time.lastIndexOf(':') ? '00:' + time : time;
                };
                
                const [, start, end, ...lines] = match.map((val, index) => index > 0 && index < 3 ? formatTime(val) : val);

                console.log(start,end,lines.join('\n'))
                return {
                    start: parseTime(start),
                    end: parseTime(end),
                    text: lines.join('\n'), // join the lines to form the text, similar to the SRT format
                };
            }).filter(sub => sub !== null);
        } //Needs more formats and failsafe
        

        subtitles.forEach(sub => {
            const div = document.createElement('div');
            div.className = 'subtitle';
            div.textContent = sub.text;
            div.dataset.start = sub.start;
            div.dataset.end = sub.end;

            div.addEventListener('click', () => {
                const mediaElement = video.style.display === 'none' ? audio : video;
                if (isFinite(sub.start)) {
                    mediaElement.currentTime = sub.start;
                    mediaElement.play();
                }
            });

            textContainer.appendChild(div);
        });

        const mediaElement = video.style.display === 'none' ? audio : video;

        mediaElement.addEventListener('timeupdate', () => {
            subtitles.forEach((sub, index) => {
                const div = textContainer.children[index];
                if (mediaElement.currentTime >= sub.start && mediaElement.currentTime <= sub.end) {
                    div.style.fontWeight = 'bold';
                    div.style.color = 'yellow';
                } else {
                    div.style.fontWeight = 'normal';
                    div.style.color = 'inherit';
                }
            });
        });

        mediaElement.load();

        document.addEventListener('keydown', function(event) {
            if (event.code === 'Space') {
                if (mediaElement.paused) {
                    mediaElement.play();
                } else {
                    mediaElement.pause();
                }
                event.preventDefault();
            }
        });
        
    };

    reader.readAsText(file);
}


function parseTime(timeString, isSimpleFormat) {
    const match = timeString.match(/(\d{2}):(\d{2}):(\d{2})[,.](\d{3})/);
    if (!match) return 0;
    const [, hours, minutes, seconds, milliseconds] = match.map(Number);
    return hours * 3600 + minutes * 60 + seconds + milliseconds / 1000;
}

function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
}
