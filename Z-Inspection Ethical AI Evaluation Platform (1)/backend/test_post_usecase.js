(async () => {
  try {
    const url = 'http://127.0.0.1:5000/api/use-cases';
    const payload = {
      title: 'post-test',
      description: 'test description',
      aiSystemCategory: 'Other',
      status: 'assigned',
      progress: 0,
      ownerId: '69341e1b77e89c5de5ae6478',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      supportingFiles: [
        { name: 'hello.txt', data: 'data:text/plain;base64,SGVsbG8sIHdvcmxkIQ==', contentType: 'text/plain' }
      ]
    };

    const resp = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const text = await resp.text();
    console.log('POST status', resp.status);
    console.log(text);
    let obj;
    try { obj = JSON.parse(text); } catch(e) { console.error('Not JSON'); }
    if (obj && obj._id) {
      const id = obj._id;
      console.log('Attempting DELETE for id', id);
      const del = await fetch(url + '/' + id, { method: 'DELETE' });
      console.log('DELETE status', del.status);
      const delText = await del.text();
      console.log(delText);
    }
  } catch (err) {
    console.error(err);
  }
})();