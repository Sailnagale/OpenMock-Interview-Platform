import PyPDF2
import docx
import io

class FileProcessor:
    @staticmethod
    def extract_text(file_content, filename):
        extension = filename.split('.')[-1].lower()
        
        if extension == 'pdf':
            return FileProcessor._read_pdf(file_content)
        elif extension in ['doc', 'docx']:
            return FileProcessor._read_docx(file_content)
        elif extension == 'txt':
            return file_content.decode('utf-8')
        else:
            raise ValueError(f"Unsupported file type: {extension}")

    @staticmethod
    def _read_pdf(file_content):
        pdf_reader = PyPDF2.PdfReader(io.BytesIO(file_content))
        text = ""
        for page in pdf_reader.pages:
            text += page.extract_text() or ""
        return text

    @staticmethod
    def _read_docx(file_content):
        doc = docx.Document(io.BytesIO(file_content))
        return "\n".join([para.text for para in doc.paragraphs])