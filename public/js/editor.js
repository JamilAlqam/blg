document.addEventListener('DOMContentLoaded', () => {
    // تهيئة محرر Quill
    const quill = new Quill('#editor', {
        theme: 'snow',
        modules: {
            toolbar: [
                [{ 'header': [1, 2, 3, false] }],
                ['bold', 'italic', 'underline', 'strike'],
                [{ 'color': [] }, { 'background': [] }],
                [{ 'list': 'ordered' }, { 'list': 'bullet' }],
                ['link', 'image'],
                ['clean']
            ]
        },
        placeholder: 'اكتب محتوى المقال هنا...',
    });

    const articleForm = document.getElementById('article-form');
    const titleInput = document.getElementById('title');
    const imageInput = document.getElementById('image');
    const imagePreview = document.getElementById('image-preview');
    const hiddenBody = document.getElementById('hidden-body');

    // معاينة الصورة
    imageInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                imagePreview.src = event.target.result;
                imagePreview.style.display = 'block';
            };
            reader.readAsDataURL(file);
        }
    });

    // عند إرسال النموذج، نسخ محتوى المحرر إلى الحقل المخفي
    articleForm.addEventListener('submit', () => {
        hiddenBody.value = quill.root.innerHTML;
    });
});