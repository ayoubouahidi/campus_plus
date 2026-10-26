from rest_framework.decorators import api_view
from rest_framework.response import Response
from drf_spectacular.utils import extend_schema


@extend_schema(
    responses={
        200: {
            "type": "object",
            "properties": {
                "status": {"type": "string", "example": "ok"},
                "message": {"type": "string", "example": "API is running"},
            },
        },
    },
)
# @extend_schema(responses=EventSerializer)
@api_view(["GET"])
def health_check(request):
    return Response({
        "status": "ok",
        "message": "API is running"
})


@api_view(["GET"])

def get_user(request):
    return Response(
        {
        }
    )