function updatePaginationControls() {
  // Busca los spans y botones de paginación
  const currentPageSpan = document.getElementById('currentPageSpan');
  const totalPagesSpan = document.getElementById('totalPagesSpan');
  if (!currentPageSpan || !totalPagesSpan) return;
  currentPageSpan.textContent = (currentProductPage + 1).toString();
  totalPagesSpan.textContent = totalProductPages.toString();

  // Habilita/deshabilita los botones según la página
  const prevBtn = document.getElementById('prevPageBtn');
  const nextBtn = document.getElementById('nextPageBtn');
  if (prevBtn) prevBtn.disabled = currentProductPage === 0;
  if (nextBtn) nextBtn.disabled = currentProductPage >= totalProductPages - 1;
}
