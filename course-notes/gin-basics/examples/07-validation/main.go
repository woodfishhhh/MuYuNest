package main

import (
	"errors"
	"fmt"
	"log"
	"net/http"
	"reflect"
	"regexp"
	"strings"
	"sync"

	"github.com/gin-gonic/gin"
	"github.com/gin-gonic/gin/binding"
	"github.com/go-playground/locales/zh"
	ut "github.com/go-playground/universal-translator"
	"github.com/go-playground/validator/v10"
	zhtranslations "github.com/go-playground/validator/v10/translations/zh"
)

type Input struct {
	Name  string `json:"name" binding:"required,min=2,max=32" label:"用户名"`
	Email string `json:"email" binding:"required,email" label:"邮箱"`
	Age   *int   `json:"age" binding:"required,gte=0,lte=150" label:"年龄"`
	IP    string `json:"ip" binding:"omitempty,ip" label:"IP 地址"`
	Slug  string `json:"slug" binding:"required,course_slug" label:"课程标识"`
}

var (
	setupOnce sync.Once
	setupErr  error
	trans     ut.Translator
	slugRule  = regexp.MustCompile(`^[a-z][a-z0-9-]{2,31}$`)
)

// 规则、标签名和翻译在开始处理请求之前注册。
func configureValidation() error {
	v, ok := binding.Validator.Engine().(*validator.Validate)
	if !ok {
		return fmt.Errorf("unexpected validator implementation")
	}
	locale := zh.New()
	uni := ut.New(locale, locale)
	trans, ok = uni.GetTranslator("zh")
	if !ok {
		return fmt.Errorf("Chinese translator is unavailable")
	}
	if err := zhtranslations.RegisterDefaultTranslations(v, trans); err != nil {
		return err
	}
	v.RegisterTagNameFunc(func(field reflect.StructField) string {
		if label := field.Tag.Get("label"); label != "" {
			return label
		}
		return field.Name
	})
	if err := v.RegisterValidation("course_slug", func(fl validator.FieldLevel) bool {
		return fl.Field().Kind() == reflect.String && slugRule.MatchString(fl.Field().String())
	}); err != nil {
		return err
	}
	return v.RegisterTranslation("course_slug", trans, func(t ut.Translator) error {
		return t.Add("course_slug", "{0}需为3到32位小写字母、数字或中划线，且以字母开头", true)
	}, func(t ut.Translator, field validator.FieldError) string {
		message, err := t.T("course_slug", field.Field())
		if err != nil {
			return "课程标识格式不正确"
		}
		return message
	})
}

func fieldErrors(err validator.ValidationErrors) map[string][]string {
	result := make(map[string][]string)
	inputType := reflect.TypeOf(Input{})
	for _, failure := range err {
		name := failure.StructField()
		if field, found := inputType.FieldByName(name); found {
			if jsonName := strings.Split(field.Tag.Get("json"), ",")[0]; jsonName != "" && jsonName != "-" {
				name = jsonName
			}
		}
		// 字段键从结构体标签读取，文案独立翻译，不拆分翻译后的字符串。
		result[name] = append(result[name], failure.Translate(trans))
	}
	return result
}

func NewRouter() *gin.Engine {
	setupOnce.Do(func() { setupErr = configureValidation() })
	if setupErr != nil {
		panic(setupErr)
	}
	r := gin.New()
	r.Use(gin.Recovery())
	if err := r.SetTrustedProxies(nil); err != nil {
		panic(err)
	}
	r.POST("/validate", func(c *gin.Context) {
		if c.ContentType() != gin.MIMEJSON {
			c.JSON(http.StatusUnsupportedMediaType, gin.H{"error": "请提交 JSON"})
			return
		}
		c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, 8192)
		var input Input
		if err := c.ShouldBindJSON(&input); err != nil {
			var failures validator.ValidationErrors
			var tooLarge *http.MaxBytesError
			switch {
			case errors.As(err, &tooLarge):
				c.JSON(http.StatusRequestEntityTooLarge, gin.H{"error": "请求体超过 8 KiB"})
			case errors.As(err, &failures):
				c.JSON(http.StatusBadRequest, gin.H{"errors": fieldErrors(failures)})
			default:
				c.JSON(http.StatusBadRequest, gin.H{"error": "JSON 格式或字段类型不正确"})
			}
			return
		}
		c.JSON(http.StatusOK, gin.H{"name": input.Name, "age": *input.Age, "slug": input.Slug})
	})
	return r
}

func main() {
	if err := NewRouter().Run("127.0.0.1:8080"); err != nil {
		log.Fatal(err)
	}
}
