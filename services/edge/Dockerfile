FROM python:3.9-slim

WORKDIR /app

RUN pip install paho-mqtt

COPY . .

CMD ["python", "edge_node.py"]
