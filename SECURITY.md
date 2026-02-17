# 🔒 보안 가이드

## API 키 관리

### `.env.local` 파일
이 프로젝트의 `.env.local`에는 아래 민감 정보가 포함됩니다:

- `VITE_GEMINI_API_KEY` — Gemini API 키
- `VERCEL_OIDC_TOKEN` — Vercel 인증 토큰

### ⚠️ 주의사항

1. **`.env.local`을 절대 git에 커밋하지 마세요** (`.gitignore`에 등록 완료)
2. 지인 테스트 완료 후 **반드시 API 키를 로테이션**하세요
   - Google AI Studio → API Keys → 새 키 생성 → 기존 키 삭제
3. 새 환경 세팅 시 `.env.local` 수동 생성 필요:
   ```
   VITE_GEMINI_API_KEY="your-new-key-here"
   ```

### 커밋 전 확인
```bash
# .env.local이 git에 추적되고 있는지 확인
git ls-files --error-unmatch .env.local 2>/dev/null && echo "⚠️ 추적되고 있음!" || echo "✅ 안전"
```
