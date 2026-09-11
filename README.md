# Guía de Implementación para Nuevos Clientes (White-Label)

Este repositorio es una plantilla (white-label) de un sistema POS y panel operativo para restaurantes (mesas, domicilios, cocina, caja, inventario y reportes).

Sigue este paso a paso para desplegar y adaptar este sistema para un **nuevo cliente**.

## 1. Preparar el Repositorio

1. Clona este repositorio base para crear la carpeta del nuevo cliente:
   ```bash
   git clone https://github.com/mrkirbag/demo-comandas.git nombre-del-cliente
   cd nombre-del-cliente
   ```
2. Elimina el historial de git (recomendado para que el cliente tenga su propio repositorio independiente):
   ```bash
   rm -rf .git
   git init
   git add .
   git commit -m "Initial commit - Sistema Base"
   ```

## 2. Instalar Dependencias

Asegúrate de tener **Node.js >= 22.12** y **pnpm** instalados.

```bash
pnpm install
```

## 3. Configurar Base de Datos (Turso)

El sistema utiliza SQLite a través de [Turso](https://turso.tech/).

1. Crea una cuenta en Turso si no la tienes o inicia sesión.
2. Crea una nueva base de datos exclusiva para este cliente:
   ```bash
   turso db create nombre-del-cliente-db
   ```
3. Obtén la URL y el Token de la base de datos:
   ```bash
   turso db show nombre-del-cliente-db --url
   turso db tokens create nombre-del-cliente-db
   ```

## 4. Configurar Uploadthing (Imágenes de Productos)

El sistema usa [Uploadthing](https://uploadthing.com/) para gestionar las imágenes cargadas.

1. Crea una cuenta o inicia sesión en Uploadthing.
2. Crea un nuevo proyecto (App) para este cliente.
3. En el panel del proyecto, ve a la sección de **API Keys**.
4. Copia el `UPLOADTHING_TOKEN`.

## 5. Variables de Entorno (.env)

Copia el archivo de ejemplo para crear tu `.env` local:

```bash
cp .env.example .env
```

Edita el `.env` y pega los datos obtenidos en los pasos anteriores:

```env
# Turso (libSQL) — base de datos
TURSO_URL=libsql://nombre-del-cliente-db-tu-org.turso.io
TURSO_AUTH_TOKEN=tu-turso-auth-token

# Sesiones JWT (mínimo 32 caracteres aleatorios)
JWT_SECRET=genera-un-secreto-largo-y-aleatorio-aqui-12345

# Imagenes en uploadthing
UPLOADTHING_TOKEN=tu-uploadthing-token
```

## 6. Personalización (White-Label)

Modifica los siguientes archivos para adaptar el sistema a la marca, colores y necesidades del nuevo cliente:

### A. Branding y Colores (`src/data/brand.ts`)
Aquí configuras la identidad visual y datos del negocio:
- **`name`, `shortName`, `tagline`**: Nombres y eslogan del restaurante.
- **`currency`**: Código y símbolo (ej. `COP` `$`, `USD` `$`, `VES` `Bs.`).
- **`colors`**: Colores primarios, secundarios, acentos. (Soporta variables hexadecimales).
- **`contact`**: Teléfono, dirección, redes sociales, horarios de apertura y cierre.
- **`delivery`**: La plantilla del mensaje de WhatsApp automático cuando un pedido está listo.

### B. Categorías de Productos e Inventario (`src/data/product-categories.ts`)
Define las categorías que aparecerán en el menú público y en el panel.
- Edita el array `productCategories` para las categorías de los platos (ej: Entradas, Platos Fuertes, Bebidas, Postres).
- Edita el array `inventoryUnits` para las unidades de medida que usa el restaurante en su inventario (ej: Kilos, Litros, Cajas, Paquetes).

### C. Assets Visuales (`public/brand/`)
Reemplaza los archivos gráficos por los del cliente. Para que no tengas que cambiar el código, manten los nombres:
- `logo.png`
- `favicon.png`
*(Nota: Si usas otros formatos como `.webp` o `.svg`, recuerda actualizar las rutas exactas dentro de `src/data/brand.ts`)*.

## 7. Inicializar la Estructura de la Base de Datos

Una vez configurado el `.env`, crea todas las tablas ejecutando las migraciones:

```bash
pnpm db:migrate
```

## 8. Sembrar Datos Iniciales (Seed)

Para poder usar el sistema, necesitas las mesas por defecto y un usuario para iniciar sesión.

Ejecuta el seed base para crear las mesas y el usuario administrador (`admin` / contrseña: `12345678`):
```bash
pnpm db:seed
```

*(Opcional)* Si quieres mostrar el sistema con productos de demostración, ejecuta:
```bash
pnpm db:seed-products
```

> **Importante:** Una vez entregado el sistema, recuerda ingresar al panel y cambiar la contraseña del usuario `admin` o crear cuentas separadas por rol (Cajero, Mesero, Cocina).

## 9. Iniciar el Proyecto Localmente

Levanta el servidor de desarrollo para verificar que la configuración se aplicó correctamente:

```bash
pnpm dev
```

El sistema estará disponible en `http://localhost:4321`.
Para ingresar al panel operativo, ve a `http://localhost:4321/login`.

---

## 10. Despliegue en Producción (Netlify, Vercel, etc.)

Cuando el sistema esté listo para el cliente:
1. Sube este nuevo repositorio a tu cuenta de GitHub.
2. Conéctalo a la plataforma de hosting (ej. Netlify).
3. Configura en la plataforma **exactamente las mismas variables de entorno** que tienes en tu `.env`.
4. El comando de compilación (build) es: `pnpm build`. (En Netlify, el archivo `netlify.toml` incluido ya se encarga de esto automáticamente).
5. ¡Listo! El cliente ya tiene su propio sistema funcionando en la nube.
