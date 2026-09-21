"""Endpoints HTTP de products: catálogo público de lectura + CRUD de admin."""

import logging
import uuid

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.core.db.session import get_db
from app.modules.auth.dependencies import get_current_admin_user
from app.modules.products.models import Product, ProductImage
from app.modules.products.schemas import ProductCreate, ProductImageRead, ProductRead, ProductUpdate
from app.modules.products.service import (
    InvalidImageError,
    ProductImageNotFoundError,
    ProductNotFoundError,
    add_product_images,
    create_product,
    delete_product,
    delete_product_image,
    get_product,
    list_products,
    update_product,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/products", tags=["products"])


@router.get("", response_model=list[ProductRead])
def list_all(db: Session = Depends(get_db)) -> list[Product]:
    return list_products(db)


@router.get("/{product_id}", response_model=ProductRead)
def get_one(product_id: int, db: Session = Depends(get_db)) -> Product:
    product = get_product(db, product_id)
    if product is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Producto no encontrado"
        )
    return product


@router.post("", response_model=ProductRead, status_code=status.HTTP_201_CREATED)
def create(
    product_in: ProductCreate,
    db: Session = Depends(get_db),
    _admin=Depends(get_current_admin_user),
) -> Product:
    product = create_product(db, product_in)
    logger.info("Producto creado: %s (id=%s)", product.name, product.id)
    return product


@router.put("/{product_id}", response_model=ProductRead)
def update(
    product_id: int,
    product_in: ProductUpdate,
    db: Session = Depends(get_db),
    _admin=Depends(get_current_admin_user),
) -> Product:
    try:
        return update_product(db, product_id, product_in)
    except ProductNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Producto no encontrado"
        ) from exc


@router.delete("/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove(
    product_id: int,
    db: Session = Depends(get_db),
    _admin=Depends(get_current_admin_user),
) -> None:
    try:
        delete_product(db, product_id)
    except ProductNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Producto no encontrado"
        ) from exc


@router.post(
    "/{product_id}/images",
    response_model=list[ProductImageRead],
    status_code=status.HTTP_201_CREATED,
)
def upload_images(
    product_id: int,
    files: list[UploadFile] = File(...),
    db: Session = Depends(get_db),
    _admin=Depends(get_current_admin_user),
) -> list[ProductImage]:
    try:
        images = add_product_images(db, product_id, files)
    except ProductNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Producto no encontrado"
        ) from exc
    except InvalidImageError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    logger.info("Subidas %s imagen(es) al producto %s", len(images), product_id)
    return images


@router.delete("/{product_id}/images/{image_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_image(
    product_id: int,
    image_id: uuid.UUID,
    db: Session = Depends(get_db),
    _admin=Depends(get_current_admin_user),
) -> None:
    try:
        delete_product_image(db, product_id, image_id)
    except ProductImageNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Imagen no encontrada"
        ) from exc
